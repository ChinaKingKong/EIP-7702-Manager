import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, Copy, ExternalLink, Trash2, Inbox, Loader2, Wallet, Key, Zap } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';
import { revokeAuthorization, delegateWithPrivateKey } from '../services/eip7702';
import { truncateAddress } from '../services/wallet';
import { getDeployedContracts } from '../services/deployedContracts';
import { getAuthorizations, saveAuthorization, updateAuthorization } from '../services/authorizationCache';
import toast from 'react-hot-toast';

export default function Authorization() {
    const { isConnected, address, chainId } = useWallet();
    const { t } = useI18n();
    const [selectedContract, setSelectedContract] = useState('');
    const [customContract, setCustomContract] = useState('');
    const [authorizations, setAuthorizations] = useState(() => getAuthorizations());
    const [error, setError] = useState(null);
    const [isRevoking, setIsRevoking] = useState(null);

    // Real delegation state
    const [privateKey, setPrivateKey] = useState('');
    const [forwardTarget, setForwardTarget] = useState('');
    const [autoForward, setAutoForward] = useState(true);
    const [delegateStatus, setDelegateStatus] = useState('');
    const [delegateResult, setDelegateResult] = useState(null);
    const [isDelegating, setIsDelegating] = useState(false);

    // Load deployed contracts from cache
    const [deployedContracts, setDeployedContracts] = useState([]);
    useEffect(() => {
        setDeployedContracts(getDeployedContracts());
    }, []);
    const contractAddress = selectedContract || customContract;

    const statusMessages = {
        creating_clients: t('auth.statusCreatingClients'),
        checking_balance: t('auth.statusCheckingBalance'),
        signing_authorization: t('auth.statusSigning'),
        sending_transaction: t('auth.statusSendingTx'),
        waiting_confirmation: t('auth.statusWaitingConf'),
    };

    const handleRealDelegate = async () => {
        if (!contractAddress || !privateKey || !forwardTarget) return;

        const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

        setIsDelegating(true);
        setError(null);
        setDelegateResult(null);
        setDelegateStatus('');

        try {
            const result = await delegateWithPrivateKey({
                privateKey: formattedPrivateKey,
                contractAddress,
                forwardTarget,
                autoForward,
                chainId: chainId || 11155111,
                onStatus: (status) => setDelegateStatus(statusMessages[status] || status),
            });

            setDelegateResult(result);

            // Save to local authorization cache
            const newAuth = {
                id: `auth-${Date.now()}`,
                walletAddress: result.account,
                delegateContract: contractAddress,
                contractName: deployedContracts.find(c => c.address.toLowerCase() === selectedContract.toLowerCase())?.name || 'Custom Contract',
                chainId: chainId || 11155111,
                status: 'active',
                timestamp: Date.now(),
                txHash: result.hash,
                isRealDelegation: true,
            };
            saveAuthorization(newAuth);
            setAuthorizations(getAuthorizations());

        } catch (err) {
            setError(err.shortMessage || err.message);
        } finally {
            setIsDelegating(false);
            setDelegateStatus('');
        }
    };

    const handleRevoke = async (authId) => {
        const auth = authorizations.find(a => a.id === authId);
        if (!auth) return;

        if (!address || address.toLowerCase() !== auth.walletAddress.toLowerCase()) {
            setError(t('auth.revokePermissionError') || 'Only the owner of this delegation can revoke it.');
            return;
        }

        setIsRevoking(authId);
        setError(null);

        try {
            await revokeAuthorization({
                account: address,
                chainId: auth.chainId || chainId
            });

            updateAuthorization(authId, { status: 'revoked' });
            setAuthorizations(getAuthorizations());
        } catch (err) {
            console.error('Revocation failed:', err);
            setError(err.shortMessage || err.message || 'Failed to revoke authorization');
        } finally {
            setIsRevoking(null);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success(t('common.copySuccess'));
        }).catch(() => { });
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

            {/* ═══════════════════════════════════════════
                 Real EIP-7702 Delegation Card
                 ═══════════════════════════════════════════ */}
            <div className="card" style={{ marginBottom: '24px', border: '1px solid var(--accent-green)', borderRadius: '12px' }}>
                <div className="card-header" style={{ background: 'rgba(34, 197, 94, 0.08)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Zap size={20} style={{ color: 'var(--accent-green)' }} />
                        {t('auth.realDelegationTitle')}
                    </h3>
                    <span className="badge badge-active">{t('common.pectra')}</span>
                </div>
                <div className="card-body">
                    <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
                        <AlertTriangle size={16} />
                        <span style={{ fontSize: '13px' }}>
                            {t('auth.realDelegationWarning')}
                        </span>
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            <Key size={14} style={{ marginRight: '4px' }} />
                            {t('auth.eoaPrivateKey')}
                        </label>
                        <input
                            className="form-input mono"
                            type="password"
                            placeholder="0x..."
                            value={privateKey}
                            onChange={(e) => setPrivateKey(e.target.value)}
                            style={{ fontSize: '13px' }}
                        />
                        <div className="form-hint">{t('auth.privateKeyHint')}</div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">{t('auth.delegateContract')}</label>
                        <select
                            className="form-select"
                            value={selectedContract}
                            onChange={(e) => setSelectedContract(e.target.value)}
                        >
                            <option value="">{t('auth.chooseDelegateContract')}</option>
                            {deployedContracts.map((c) => (
                                <option key={c.address} value={c.address}>
                                    {c.name} — {truncateAddress(c.address)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {!selectedContract && (
                        <div className="form-group">
                            <label className="form-label">{t('auth.customContractAddressLabel')}</label>
                            <input
                                className="form-input mono"
                                type="text"
                                placeholder="0x..."
                                value={customContract}
                                onChange={(e) => setCustomContract(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">{t('auth.forwardTargetLabel')}</label>
                        <input
                            className="form-input mono"
                            type="text"
                            placeholder="0x..."
                            value={forwardTarget}
                            onChange={(e) => setForwardTarget(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="checkbox"
                                checked={autoForward}
                                onChange={(e) => setAutoForward(e.target.checked)}
                                style={{ width: '16px', height: '16px' }}
                            />
                            {t('auth.enableAutoForward')}
                        </label>
                        <div className="form-hint">{t('auth.autoForwardHint')}</div>
                    </div>

                    <button
                        className="btn btn-primary btn-lg btn-full"
                        onClick={handleRealDelegate}
                        disabled={isDelegating || !contractAddress || !privateKey || !forwardTarget}
                        style={{ marginTop: '8px' }}
                    >
                        {isDelegating ? (
                            <><Loader2 size={18} className="spin" /> {delegateStatus || t('auth.processing')}</>
                        ) : (
                            <><Zap size={18} /> {t('auth.executeDelegation')}</>
                        )}
                    </button>

                    {error && !delegateResult && (
                        <div className="alert alert-error" style={{ marginTop: '16px' }}>
                            <XCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {delegateResult && (
                        <div style={{ marginTop: '16px' }}>
                            <div className="alert alert-info" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'var(--accent-green)' }}>
                                <CheckCircle size={18} style={{ color: 'var(--accent-green)' }} />
                                <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                                    {t('auth.successAlert')}
                                </span>
                            </div>
                            <div className="tx-preview" style={{ marginTop: '12px' }}>
                                <div className="tx-preview-row">
                                    <span className="tx-preview-label">{t('auth.eoaAddress')}</span>
                                    <span className="tx-preview-value">{truncateAddress(delegateResult.account)}</span>
                                </div>
                                <div className="tx-preview-row">
                                    <span className="tx-preview-label">Tx Hash</span>
                                    <span className="tx-preview-value" style={{ cursor: 'pointer' }} onClick={() => copyToClipboard(delegateResult.hash)}>
                                        {truncateAddress(delegateResult.hash)} <Copy size={12} />
                                    </span>
                                </div>
                                <div className="tx-preview-row">
                                    <span className="tx-preview-label">{t('auth.block')}</span>
                                    <span className="tx-preview-value">{delegateResult.blockNumber?.toString()}</span>
                                </div>
                                <div className="tx-preview-row">
                                    <span className="tx-preview-label">{t('auth.gasUsed')}</span>
                                    <span className="tx-preview-value">{delegateResult.gasUsed?.toString()}</span>
                                </div>
                                {delegateResult.config && (
                                    <>
                                        <div className="tx-preview-row">
                                            <span className="tx-preview-label">{t('auth.forwardTarget')}</span>
                                            <span className="tx-preview-value">{truncateAddress(delegateResult.config.forwardTarget)}</span>
                                        </div>
                                        <div className="tx-preview-row">
                                            <span className="tx-preview-label">{t('auth.autoForward')}</span>
                                            <span className="tx-preview-value">{delegateResult.config.autoForwardEnabled ? t('auth.enabledYes') : t('auth.enabledNo')}</span>
                                        </div>
                                        <div className="tx-preview-row">
                                            <span className="tx-preview-label">{t('auth.initialized')}</span>
                                            <span className="tx-preview-value">{delegateResult.config.initialized ? t('auth.initializedYes') : t('auth.initializedNo')}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(34, 197, 94, 0.06)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {t('auth.successMessage')} <strong style={{ color: 'var(--text-primary)' }}>{truncateAddress(delegateResult.account)}</strong> {t('auth.successMessageEnd')}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Authorization List */}
            <div className="card">
                <div className="card-header">
                    <h3>{t('auth.authHistory')}</h3>
                    {address && (
                        <span className="badge badge-info">
                            {authorizations.filter(a => a.status === 'active' && a.walletAddress?.toLowerCase() === address.toLowerCase() && a.chainId === chainId).length} {t('common.active')}
                        </span>
                    )}
                </div>
                <div className="card-body" style={{ padding: '0' }}>
                    {!address ? (
                        <div className="empty-state">
                            <Wallet size={40} />
                            <div className="empty-state-title">{t('common.walletNotConnected')}</div>
                            <div className="empty-state-desc">{t('common.connectWalletToViewHistory')}</div>
                        </div>
                    ) : authorizations.filter(a => a.walletAddress?.toLowerCase() === address.toLowerCase() && a.chainId === chainId).length === 0 ? (
                        <div className="empty-state">
                            <Inbox size={40} />
                            <div className="empty-state-title">{t('auth.noAuthorizations')}</div>
                            <div className="empty-state-desc">{t('auth.noAuthorizationsDesc')}</div>
                        </div>
                    ) : (
                        authorizations.filter(a => a.walletAddress?.toLowerCase() === address.toLowerCase() && a.chainId === chainId).map((auth) => (
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
                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                        {auth.contractName}
                                        {auth.isRealDelegation && (
                                            <span className="badge badge-active" style={{ marginLeft: '8px', fontSize: '10px' }}>{t('auth.realDelegationBadge')}</span>
                                        )}
                                    </div>
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
                                            disabled={isRevoking === auth.id || (address && address.toLowerCase() !== auth.walletAddress.toLowerCase())}
                                            title={address && address.toLowerCase() !== auth.walletAddress.toLowerCase() ? t('auth.revokePermissionError') : t('auth.revokeOnChain')}
                                        >
                                            {isRevoking === auth.id ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
