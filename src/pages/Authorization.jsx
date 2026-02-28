import React, { useState } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, Copy, ExternalLink, Trash2, Inbox } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';
import { signAuthorization, revokeAuthorization } from '../services/eip7702';
import { truncateAddress } from '../services/wallet';

// 真实的 EIP-7702 委托合约
// 部署后请更新合约地址
const DELEGATE_CONTRACTS = [
    {
        name: 'EIP7702AutoForwarder',
        address: '', // TODO: 部署后填入合约地址
        description: 'Auto-forward ETH & sweep ERC20 to target wallet, with gas sponsorship',
    },
];

export default function Authorization() {
    const { isConnected, address, chainId } = useWallet();
    const { t } = useI18n();
    const [step, setStep] = useState(1);
    const [selectedContract, setSelectedContract] = useState('');
    const [customContract, setCustomContract] = useState('');
    const [targetWallet, setTargetWallet] = useState('');
    const [authorizations, setAuthorizations] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const contractAddress = selectedContract || customContract;

    const handleSign = async () => {
        if (!isConnected || !contractAddress) return;

        const wallet = targetWallet || address;
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const auth = await signAuthorization({
                contractAddress,
                account: wallet,
                chainId,
            });

            const newAuth = {
                id: `auth-${Date.now()}`,
                walletAddress: wallet,
                delegateContract: contractAddress,
                contractName: DELEGATE_CONTRACTS.find(c => c.address === selectedContract)?.name || 'Custom Contract',
                chainId,
                status: 'active',
                timestamp: Date.now(),
                txHash: '0x' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2),
            };

            setAuthorizations(prev => [newAuth, ...prev]);
            setResult({
                message: t('auth.signSuccess'),
                auth: newAuth,
            });
            setStep(3);
        } catch (err) {
            setError(err.message || t('auth.failedToSign'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevoke = async (authId) => {
        setAuthorizations(prev =>
            prev.map(a => a.id === authId ? { ...a, status: 'revoked' } : a)
        );
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).catch(() => { });
    };

    const formatTime = (ts) => {
        const diff = Date.now() - ts;
        if (diff < 3600000) return t('common.minAgo', { n: Math.floor(diff / 60000) });
        if (diff < 86400000) return t('common.hoursAgo', { n: Math.floor(diff / 3600000) });
        return t('common.daysAgo', { n: Math.floor(diff / 86400000) });
    };

    return (
        <div>
            {/* Info Alert */}
            <div className="alert alert-info">
                <Shield size={18} />
                <span>{t('auth.infoAlert')}</span>
            </div>

            {/* Flow Steps */}
            <div className="flow-steps">
                <div className={`flow-step ${step >= 1 ? (step > 1 ? 'completed' : 'active') : ''}`}>
                    <span className="flow-step-number">1</span>
                    <span>{t('auth.step1')}</span>
                </div>
                <div className={`flow-connector ${step > 1 ? 'done' : ''}`} />
                <div className={`flow-step ${step >= 2 ? (step > 2 ? 'completed' : 'active') : ''}`}>
                    <span className="flow-step-number">2</span>
                    <span>{t('auth.step2')}</span>
                </div>
                <div className={`flow-connector ${step > 2 ? 'done' : ''}`} />
                <div className={`flow-step ${step >= 3 ? 'active' : ''}`}>
                    <span className="flow-step-number">3</span>
                    <span>{t('auth.step3')}</span>
                </div>
            </div>

            <div className="page-grid-wide">
                {/* Left: Sign Authorization Form */}
                <div className="card">
                    <div className="card-header">
                        <h3>{t('auth.signAuthorization')}</h3>
                        {step > 1 && (
                            <button className="btn btn-secondary" onClick={() => { setStep(1); setResult(null); setError(null); }} style={{ padding: '6px 14px', fontSize: '13px' }}>
                                {t('common.reset')}
                            </button>
                        )}
                    </div>
                    <div className="card-body">
                        {step === 1 && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">{t('auth.targetWallet')}</label>
                                    <input
                                        className="form-input mono"
                                        type="text"
                                        placeholder={address || '0x...'}
                                        value={targetWallet}
                                        onChange={(e) => setTargetWallet(e.target.value)}
                                    />
                                    <div className="form-hint">{t('auth.targetWalletHint')}</div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{t('auth.delegateContract')}</label>
                                    <select
                                        className="form-select"
                                        value={selectedContract}
                                        onChange={(e) => setSelectedContract(e.target.value)}
                                    >
                                        <option value="">{t('auth.chooseDelegateContract')}</option>
                                        {DELEGATE_CONTRACTS.filter(c => c.address).map((c) => (
                                            <option key={c.address} value={c.address}>
                                                {c.name} — {truncateAddress(c.address)}
                                            </option>
                                        ))}
                                        <option value="">{t('auth.customAddress')}</option>
                                    </select>
                                </div>

                                {!selectedContract && (
                                    <div className="form-group">
                                        <label className="form-label">{t('auth.customContractAddress')}</label>
                                        <input
                                            className="form-input mono"
                                            type="text"
                                            placeholder="0x..."
                                            value={customContract}
                                            onChange={(e) => setCustomContract(e.target.value)}
                                        />
                                    </div>
                                )}

                                <button
                                    className="btn btn-primary btn-lg btn-full"
                                    onClick={() => setStep(2)}
                                    disabled={!contractAddress}
                                    style={{ marginTop: '8px' }}
                                >
                                    <Shield size={18} /> {t('auth.continueToSign')}
                                </button>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <div className="alert alert-warning">
                                    <AlertTriangle size={18} />
                                    <span>{t('auth.signWarning')}</span>
                                </div>

                                <div className="tx-preview">
                                    <div className="tx-preview-row">
                                        <span className="tx-preview-label">{t('auth.wallet')}</span>
                                        <span className="tx-preview-value">{truncateAddress(targetWallet || address || '0x0000...0000')}</span>
                                    </div>
                                    <div className="tx-preview-row">
                                        <span className="tx-preview-label">{t('auth.delegateTo')}</span>
                                        <span className="tx-preview-value" style={{ color: 'var(--accent-blue)' }}>
                                            {truncateAddress(contractAddress)}
                                        </span>
                                    </div>
                                    <div className="tx-preview-row">
                                        <span className="tx-preview-label">{t('auth.chain')}</span>
                                        <span className="tx-preview-value">
                                            {chainId === 1 ? 'Ethereum' : chainId === 11155111 ? 'Sepolia' : `Chain ${chainId || 1}`}
                                        </span>
                                    </div>
                                    <div className="tx-preview-row">
                                        <span className="tx-preview-label">{t('auth.type')}</span>
                                        <span className="tx-preview-value">0x04 (EIP-7702)</span>
                                    </div>
                                </div>

                                <button
                                    className="btn btn-primary btn-lg btn-full"
                                    onClick={handleSign}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>{t('auth.signing')}</>
                                    ) : (
                                        <>
                                            <Shield size={18} /> {t('auth.signAuthorization')}
                                        </>
                                    )}
                                </button>

                                {error && (
                                    <div className="alert alert-error" style={{ marginTop: '16px' }}>
                                        <XCircle size={18} />
                                        <span>{error}</span>
                                    </div>
                                )}
                            </>
                        )}

                        {step === 3 && result && (
                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                <CheckCircle size={48} style={{ color: 'var(--accent-green)', marginBottom: '16px' }} />
                                <h4 style={{ marginBottom: '8px', fontSize: '18px' }}>{result.message}</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
                                    {t('auth.eoaDelegated')}
                                </p>
                                <div className="tx-preview">
                                    <div className="tx-preview-row">
                                        <span className="tx-preview-label">{t('auth.contract')}</span>
                                        <span className="tx-preview-value">{result.auth.contractName}</span>
                                    </div>
                                    <div className="tx-preview-row">
                                        <span className="tx-preview-label">{t('auth.txHash')}</span>
                                        <span className="tx-preview-value" style={{ cursor: 'pointer' }} onClick={() => copyToClipboard(result.auth.txHash)}>
                                            {truncateAddress(result.auth.txHash)} <Copy size={12} />
                                        </span>
                                    </div>
                                </div>
                                <button className="btn btn-secondary" onClick={() => { setStep(1); setResult(null); }} style={{ marginTop: '12px' }}>
                                    {t('auth.newAuthorization')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Authorization List */}
                <div className="card">
                    <div className="card-header">
                        <h3>{t('auth.authHistory')}</h3>
                        <span className="badge badge-info">{authorizations.filter(a => a.status === 'active').length} {t('common.active')}</span>
                    </div>
                    <div className="card-body" style={{ padding: '0' }}>
                        {authorizations.length === 0 ? (
                            <div className="empty-state">
                                <Inbox size={40} />
                                <div className="empty-state-title">{t('auth.noAuthorizations')}</div>
                                <div className="empty-state-desc">{t('auth.noAuthorizationsDesc')}</div>
                            </div>
                        ) : (
                            authorizations.map((auth) => (
                                <div
                                    key={auth.id}
                                    style={{
                                        padding: '16px 20px',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '14px',
                                        transition: 'background 150ms',
                                    }}
                                    className="activity-item"
                                >
                                    <div className={`activity-icon ${auth.status === 'active' ? 'auth' : 'revoke'}`}>
                                        {auth.status === 'active' ? <Shield size={18} /> : <XCircle size={18} />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{auth.contractName}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                                            {truncateAddress(auth.delegateContract)}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                            {formatTime(auth.timestamp)}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className={`badge ${auth.status === 'active' ? 'badge-active' : 'badge-revoked'}`}>
                                            {auth.status === 'active' ? t('common.active') : t('common.revoked')}
                                        </span>
                                        {auth.status === 'active' && (
                                            <button
                                                className="btn btn-danger"
                                                style={{ padding: '6px 10px', fontSize: '12px' }}
                                                onClick={() => handleRevoke(auth.id)}
                                            >
                                                <Trash2 size={12} /> {t('auth.revoke')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
