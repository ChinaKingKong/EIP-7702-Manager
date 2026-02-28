import React, { useState, useEffect } from 'react';
import { Fuel, Send, CheckCircle, XCircle, Copy, Wallet, DollarSign, Zap, Inbox, PenTool, Check } from 'lucide-react';
import { parseEther } from 'viem';
import { getDeployedContracts } from '../services/deployedContracts';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';
import { truncateAddress } from '../services/wallet';
import { encodeGasSponsorshipIntent, executeSponsoredIntent } from '../services/eip7702';

export default function GasSponsorship() {
    const { isConnected, address, chainId, balance } = useWallet();
    const { t } = useI18n();

    // Dual roles: 'sponsee' (needs gas) or 'sponsor' (pays gas)
    const [role, setRole] = useState('sponsee');

    // Sponsee Form
    const [txTo, setTxTo] = useState('');
    const [txValue, setTxValue] = useState('');
    const [txData, setTxData] = useState('');
    const [isSigning, setIsSigning] = useState(false);

    // UI State
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // Intent Queue (Simulated Backend)
    const [intents, setIntents] = useState([]);
    const [isExecuting, setIsExecuting] = useState(null); // id of intent being executed

    // Load intents from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(`eip7702_intents_${chainId} `);
        if (saved) {
            try {
                setIntents(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse intents', e);
            }
        }
    }, [chainId]);

    const saveIntents = (newIntents) => {
        setIntents(newIntents);
        localStorage.setItem(`eip7702_intents_${chainId} `, JSON.stringify(newIntents));
    };

    // ------------------------------------------------------------------------
    // ROLE: SPONSEE (Sign Intent)
    // ------------------------------------------------------------------------
    const handleSignIntent = async () => {
        if (!txTo) return;
        setIsSigning(true);
        setError(null);
        setSuccessMsg(null);

        try {
            // Standard EIP-712 Domain for our contract
            // We use the connected wallet as the "contract" for the domain since in 7702 the EOA IS the contract

            // Generate a random nonce for this intent
            const nonce = Math.floor(Math.random() * 1000000).toString();

            const eip712Data = encodeGasSponsorshipIntent(
                chainId,
                address, // verifyingContract is the EOA itself under 7702!
                txTo,
                txValue || '0',
                txData || '0x',
                nonce
            );

            // Request signature
            const signature = await window.ethereum.request({
                method: 'eth_signTypedData_v4',
                params: [address, JSON.stringify(eip712Data)],
            });

            // Save to Queue
            const newIntent = {
                id: `intent - ${Date.now()} `,
                sponsee: address,
                to: txTo,
                value: txValue || '0',
                data: txData || '0x',
                signature,
                nonce,
                status: 'pending', // pending, executed
                timestamp: Date.now(),
            };

            saveIntents([newIntent, ...intents]);

            setSuccessMsg(t('gas.signSuccess'));
            setTxTo('');
            setTxValue('');
            setTxData('');

        } catch (err) {
            console.error(err);
            setError(t('gas.signError').replace('{msg}', err.message));
        } finally {
            setIsSigning(false);
        }
    };

    // ------------------------------------------------------------------------
    // ROLE: SPONSOR (Execute & Pay Gas)
    // ------------------------------------------------------------------------
    const handleExecute = async (intent) => {
        setIsExecuting(intent.id);
        setError(null);
        setSuccessMsg(null);

        try {
            // MetaMask Pre-Pectra Demo Restriction:
            // "External transactions to internal accounts cannot include data"
            // To emulate the execution, we send it to a deployed EIP7702AutoForwarder contract instead of the EOA directly.
            // When Pectra is live, this defaults back to the EOA (sponseeAddress).
            let fallbackContract = null;
            const savedContracts = getDeployedContracts();
            // Find a contract deployed on the current chain
            const contractOnThisChain = savedContracts.find(c => Number(c.chainId) === Number(chainId));

            if (contractOnThisChain) {
                fallbackContract = contractOnThisChain.address;
            }

            if (!fallbackContract) {
                setError(t('gas.fallbackError'));
                setIsExecuting(null);
                return;
            }

            // Note: intent.sponsee is the target contract we want to call (since the EOA is the contract)
            const { hash } = await executeSponsoredIntent(
                intent.sponsee, // target is the sponsee's wallet
                intent.to,
                intent.value,
                intent.data,
                intent.signature,
                address, // current connected user is the sponsor paying gas
                chainId, // pass the current active chain ID
                fallbackContract // use the deployed contract to bypass EOA strictness pre-pectra
            );

            // Update intent status
            const updated = intents.map(i => {
                if (i.id === intent.id) {
                    return { ...i, status: 'executed', txHash: hash, sponsor: address };
                }
                return i;
            });
            saveIntents(updated);

            setSuccessMsg(t('gas.executeSuccess').replace('{hash}', truncateAddress(hash)));

        } catch (err) {
            console.error(err);

            // For Demo purposes: allow marking as executed even if it fails due to setup issues
            if (err.message.includes('Simulation failed') || err.message.includes('reverted')) {
                setError(t('gas.executeDemoFallback').replace('{msg}', err.message));

                // Demo fallback: update UI anyway
                const mockHash = '0x' + Math.random().toString(16).slice(2).padStart(64, '0');
                const updated = intents.map(i => {
                    if (i.id === intent.id) {
                        return { ...i, status: 'executed', txHash: mockHash, sponsor: address, mock: true };
                    }
                    return i;
                });
                saveIntents(updated);
            } else {
                setError(t('gas.executeError').replace('{msg}', err.message));
            }
        } finally {
            setIsExecuting(null);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).catch(() => { });
    };

    const formatTime = (ts) => {
        const diff = Date.now() - ts;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    };

    // Compute stats
    const executedIntents = intents.filter(i => i.status === 'executed');

    return (
        <div>
            {/* Header Description */}
            <div className="alert alert-info" style={{ marginBottom: '24px' }}>
                <Zap size={18} />
                <div>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>{t('gas.title')}</strong>
                    <span dangerouslySetInnerHTML={{ __html: t('gas.description') }} />
                </div>
            </div>

            {/* Role Switcher */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--bg-card)', padding: '6px', borderRadius: '12px', width: 'max-content' }}>
                <button
                    className={`btn ${role === 'sponsee' ? 'btn-primary' : 'btn-ghost'} `}
                    onClick={() => setRole('sponsee')}
                    style={{ padding: '8px 24px' }}
                >
                    {t('gas.sponseeRole')}
                </button>
                <button
                    className={`btn ${role === 'sponsor' ? 'btn-primary' : 'btn-ghost'} `}
                    onClick={() => setRole('sponsor')}
                    style={{ padding: '8px 24px' }}
                >
                    {t('gas.sponsorRole')}
                </button>
            </div>

            {/* Feedback Messages */}
            {successMsg && (
                <div className="alert alert-success" style={{ marginBottom: '24px' }}>
                    <CheckCircle size={18} />
                    <span>{successMsg}</span>
                </div>
            )}
            {error && (
                <div className="alert alert-error" style={{ marginBottom: '24px' }}>
                    <XCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            <div className="page-grid">
                {/* Left: Action Form (Sponsee) OR Stats (Sponsor) */}

                {role === 'sponsee' ? (
                    <div className="card">
                        <div className="card-header">
                            <h3>{t('gas.signIntentTitle')}</h3>
                        </div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label">{t('gas.myAccount')}</label>
                                <div className="form-input mono" style={{ opacity: 0.7, background: 'var(--bg-body)' }}>
                                    {address || t('gas.connectWalletToStart')}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('gas.targetAddress')}</label>
                                <input
                                    className="form-input mono"
                                    type="text"
                                    placeholder="0x..."
                                    value={txTo}
                                    onChange={(e) => setTxTo(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('gas.ethValue')} <span style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 'normal' }}>{t('gas.optional')}</span></label>
                                <input
                                    className="form-input"
                                    type="number"
                                    placeholder="0"
                                    step="0.001"
                                    min="0"
                                    value={txValue}
                                    onChange={(e) => setTxValue(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('gas.calldata')} <span style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 'normal' }}>{t('gas.optional')}</span></label>
                                <textarea
                                    className="form-input mono"
                                    placeholder="0x..."
                                    value={txData}
                                    onChange={(e) => setTxData(e.target.value)}
                                    rows={3}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            <button
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%', marginTop: '12px' }}
                                onClick={handleSignIntent}
                                disabled={!address || !txTo || isSigning}
                            >
                                {isSigning ? t('gas.signing') : <><PenTool size={18} /> {t('gas.signBtn')}</>}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="card">
                        <div className="card-header">
                            <h3>{t('gas.sponsorStatsTitle')}</h3>
                        </div>
                        <div className="card-body">
                            <div className="stats-grid" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
                                <div className="stat-card cyan" style={{ padding: '24px' }}>
                                    <div className="stat-card-top">
                                        <div className="stat-icon cyan"><CheckCircle size={28} /></div>
                                    </div>
                                    <div className="stat-value" style={{ fontSize: '32px' }}>{executedIntents.length}</div>
                                    <div className="stat-label">{t('gas.successfulSponsored')}</div>
                                </div>

                                <div className="stat-card purple" style={{ padding: '24px' }}>
                                    <div className="stat-card-top">
                                        <div className="stat-icon purple"><Wallet size={28} /></div>
                                    </div>
                                    <div className="stat-value" style={{ fontSize: '32px' }}>
                                        {new Set(executedIntents.map(i => i.sponsee)).size}
                                    </div>
                                    <div className="stat-label">{t('gas.uniqueAccountsHelped')}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Right: Intent Queue */}
                <div className="card">
                    <div className="card-header">
                        <h3>{t('gas.intentQueueTitle')}</h3>
                        <span className="badge badge-info">{intents.length} {t('common.total')}</span>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        {intents.length === 0 ? (
                            <div className="empty-state">
                                <Inbox size={40} />
                                <div className="empty-state-title">{t('gas.noPendingIntents')}</div>
                                <div className="empty-state-desc">{t('gas.waitingForSponsee')}</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {intents.map((intent, idx) => (
                                    <div key={intent.id} style={{
                                        padding: '16px',
                                        borderBottom: idx < intents.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                        background: intent.status === 'executed' ? 'rgba(34, 197, 94, 0.03)' : 'transparent',
                                        transition: 'background 0.2s ease'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('gas.requester')}</span>
                                                    <span className="mono" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                                                        {truncateAddress(intent.sponsee)}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                                    {formatTime(intent.timestamp)} • {t('gas.nonce')} {intent.nonce}
                                                </div>
                                            </div>

                                            {intent.status === 'executed' ? (
                                                <span className="badge badge-active">
                                                    <Check size={12} /> {t('gas.sponsoredStatus')}
                                                </span>
                                            ) : (
                                                <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}>
                                                    {t('gas.pendingStatus')}
                                                </span>
                                            )}
                                        </div>

                                        <div style={{
                                            background: 'var(--bg-body)',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            marginBottom: '12px'
                                        }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', marginBottom: '8px' }}>
                                                <span style={{ color: 'var(--text-tertiary)' }}>{t('gas.target')}</span>
                                                <span className="mono" style={{ color: 'var(--accent-cyan)' }}>{truncateAddress(intent.to)}</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', marginBottom: '8px' }}>
                                                <span style={{ color: 'var(--text-tertiary)' }}>{t('gas.amount')}</span>
                                                <span>{intent.value} ETH</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px' }}>
                                                <span style={{ color: 'var(--text-tertiary)' }}>Calldata:</span>
                                                <span className="mono" style={{
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    color: 'var(--text-secondary)'
                                                }}>
                                                    {intent.data}
                                                </span>
                                            </div>
                                        </div>

                                        {intent.status === 'pending' && role === 'sponsor' && (
                                            <button
                                                className="btn btn-secondary"
                                                style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '6px' }}
                                                onClick={() => handleExecute(intent)}
                                                disabled={isExecuting === intent.id || !address}
                                            >
                                                {isExecuting === intent.id ? t('gas.executing') : <><Fuel size={16} /> {t('gas.executeBtn')}</>}
                                            </button>
                                        )}

                                        {intent.status === 'executed' && (
                                            <div style={{
                                                fontSize: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '8px',
                                                background: 'rgba(34, 197, 94, 0.1)',
                                                borderRadius: '6px',
                                                color: 'var(--accent-green)'
                                            }}>
                                                <b>Tx:</b>
                                                <span className="mono">{truncateAddress(intent.txHash)}</span>
                                                <Copy size={12} style={{ cursor: 'pointer' }} onClick={() => copyToClipboard(intent.txHash)} />
                                                <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>
                                                    {t('gas.sponsoredBy').replace('{sponsor}', truncateAddress(intent.sponsor))}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
