import React, { useState, useEffect } from 'react';
import { Shield, ShieldOff, CheckCircle, XCircle, AlertTriangle, Copy, ExternalLink, Trash2, Inbox, Loader2, Wallet, Key, Zap, Coins, Image as ImageIcon } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';
import { revokeAuthorization, revokeWithPrivateKey, delegateWithPrivateKey } from '../services/eip7702';
import { truncateAddress } from '../services/wallet';
import { getDeployedContracts } from '../services/deployedContracts';
import { getAuthorizations, saveAuthorization, updateAuthorization, removeAuthorization } from '../services/authorizationCache';
import { privateKeyToAccount } from 'viem/accounts';
import toast from 'react-hot-toast';

export default function Authorization() {
    const { isConnected, address, chainId, disconnectedChainId } = useWallet();
    const { t } = useI18n();

    const activeChainId = isConnected ? chainId : disconnectedChainId;
    const [selectedContract, setSelectedContract] = useState('');
    const [customContract, setCustomContract] = useState('');
    const [authorizations, setAuthorizations] = useState(() => getAuthorizations());
    const [error, setError] = useState(null);
    const [isRevoking, setIsRevoking] = useState(null);

    // Real delegation state
    const [privateKey, setPrivateKey] = useState('');
    const [forwardTarget, setForwardTarget] = useState('');
    const [autoForward, setAutoForward] = useState(true);
    const [sponsorKey, setSponsorKey] = useState('');
    const [delegateStatus, setDelegateStatus] = useState('');
    const [delegateResult, setDelegateResult] = useState(null);
    const [isDelegating, setIsDelegating] = useState(false);

    // Load deployed contracts from cache
    const [deployedContracts, setDeployedContracts] = useState([]);
    useEffect(() => {
        const contracts = getDeployedContracts();
        setDeployedContracts(contracts);
        
        // Default to the most recently deployed contract
        if (contracts.length > 0 && !customContract) {
            const latest = contracts[0].address;
            setCustomContract(latest);
            setSelectedContract(latest);
        }
    }, []);
    const contractAddress = selectedContract || customContract;

    // 追踪的地址列表：包含当前已连接的钱包地址，以及当前输入的私钥对应的地址
    const trackedAddresses = (() => {
        const addrs = [];
        if (address) addrs.push(address.toLowerCase());
        
        // 尝试解析当前输入的私钥
        let pk = privateKey.trim();
        if (pk) {
            if (!pk.startsWith('0x')) pk = '0x' + pk;
            if (/^0x[0-9a-fA-F]{64}$/.test(pk)) {
                try {
                    const pkAddress = privateKeyToAccount(pk).address;
                    if (pkAddress && !addrs.includes(pkAddress.toLowerCase())) {
                        addrs.push(pkAddress.toLowerCase());
                    }
                } catch (e) {
                    // 解析失败则忽略
                }
            }
        }
        
        return addrs;
    })();

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
            const formattedSponsorKey = sponsorKey.trim() ? (sponsorKey.trim().startsWith('0x') ? sponsorKey.trim() : `0x${sponsorKey.trim()}`) : null;

            const result = await delegateWithPrivateKey({
                privateKey: formattedPrivateKey,
                contractAddress,
                forwardTarget,
                autoForward,
                emergencyRescue: forwardTarget,
                chainId: activeChainId || 11155111,
                sponsorPrivateKey: formattedSponsorKey,
                onStatus: (status) => setDelegateStatus(statusMessages[status] || status),
            });


            setDelegateResult(result);

            // Save to local authorization cache
            const newAuth = {
                id: `auth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                walletAddress: result.account,
                delegateContract: contractAddress,
                contractName: deployedContracts.find(c => c.address.toLowerCase() === contractAddress.toLowerCase())?.name || t('nav.autoForwardConfig'),
                chainId: Number(activeChainId || 11155111),
                status: 'active',
                timestamp: Date.now(),
                txHash: result.hash,
                isRealDelegation: true,
                rawAuth: result.authorization,
            };

            saveAuthorization(newAuth);

            const updatedList = getAuthorizations();
            setAuthorizations(updatedList);

        } catch (err) {
            setError(err.shortMessage || err.message);
        } finally {
            setIsDelegating(false);
            setDelegateStatus('');
        }
    };

    // Listen for localStorage changes (sync history across tabs/pages)
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'eip7702_authorizations') {
                setAuthorizations(getAuthorizations());
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

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
            // Priority 1: Use private key if it matches the auth's walletAddress
            const pk = privateKey.trim();
            const formattedPk = pk.startsWith('0x') ? pk : `0x${pk}`;
            let pkAddress = null;
            if (/^0x[0-9a-fA-F]{64}$/.test(formattedPk)) {
                try {
                    pkAddress = privateKeyToAccount(formattedPk).address;
                } catch (_) { }
            }

            if (pkAddress && pkAddress.toLowerCase() === auth.walletAddress.toLowerCase()) {
                await revokeWithPrivateKey({
                    privateKey: formattedPk,
                    chainId: auth.chainId || activeChainId
                });
            } else if (address && address.toLowerCase() === auth.walletAddress.toLowerCase()) {
                // Priority 2: Use connected wallet
                await revokeAuthorization({
                    account: address,
                    chainId: auth.chainId || chainId
                });
            } else {
                throw new Error(t('auth.revokePermissionError') || 'Please enter the private key for this account or connect the correct wallet.');
            }

            updateAuthorization(authId, { status: 'revoked' });
            setAuthorizations(getAuthorizations());
            toast.success(t('auth.revokeSuccess') || 'Revocation successful');
        } catch (err) {
            console.error('Revocation failed:', err);
            setError(err.shortMessage || err.message || 'Failed to revoke authorization');
        } finally {
            setIsRevoking(null);
        }
    };

    const handleDeleteAuth = (authId) => {
        const updatedList = removeAuthorization(authId);
        setAuthorizations(updatedList);
        toast.success(t('auth.deleteSuccess') || 'History record removed');
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
            <div className="card" style={{ marginBottom: '24px', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
                <div className="card-header" style={{ background: 'var(--bg-glass)' }}>
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
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Wallet size={14} />
                            {t('auth.sponsorKeyLabel') || 'Gas 赞助商私钥（可选）'}
                        </label>
                        <input
                            className="form-input mono"
                            type="password"
                            placeholder={t('auth.sponsorKeyPlaceholder') || '留空则由 EOA 自己支付 Gas'}
                            value={sponsorKey}
                            onChange={(e) => setSponsorKey(e.target.value)}
                            style={{ fontSize: '13px' }}
                        />
                        <div className="form-hint">{t('auth.sponsorKeyHint') || '填写后由赞助商钱包支付 Gas，EOA 无需 ETH 也可完成委托'}</div>
                        <div className="alert alert-warning" style={{ marginTop: '8px', padding: '8px 12px', fontSize: '12px', lineHeight: '1.5' }}>
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span>{t('auth.sponsorKeyRequiredForSweep') || '若要在【搬运代币】页由赞助商代付 Gas，此处必须填写与搬运页相同的赞助商私钥，否则链上 Gas 代付人为空，搬运会报错。'}</span>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">{t('auth.delegateContract')}</label>
                        <input
                            className="form-input mono"
                            type="text"
                            list="deployed-contracts-list"
                            placeholder={t('auth.chooseDelegateContract') || '选择或输入合约地址 0x...'}
                            value={customContract}
                            onChange={(e) => { setCustomContract(e.target.value); setSelectedContract(e.target.value); }}
                            style={{ fontSize: '13px' }}
                        />
                        <datalist id="deployed-contracts-list">
                            {deployedContracts.map((c) => (
                                <option key={c.address} value={c.address}>
                                    {c.name} — {truncateAddress(c.address)}
                                </option>
                            ))}
                        </datalist>
                    </div>

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

                    <hr className="divider" style={{ margin: '16px 0', borderColor: 'var(--border-subtle)' }} />


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
                    {trackedAddresses.length > 0 && (
                        <span className="badge badge-info">
                            {authorizations.filter(a => a.status === 'active' && trackedAddresses.includes(a.walletAddress?.toLowerCase()) && Number(a.chainId) === Number(activeChainId)).length} {t('common.active')}
                        </span>
                    )}
                </div>
                <div className="card-body" style={{ padding: '0' }}>
                    {trackedAddresses.length === 0 ? (
                        <div className="empty-state">
                            <Wallet size={40} />
                            <div className="empty-state-title">{t('common.connectWalletToViewHistory')}</div>
                            <div className="empty-state-desc">{t('auth.connectWalletToViewHistory')}</div>
                        </div>
                    ) : authorizations.filter(a =>
                        trackedAddresses.includes(a.walletAddress?.toLowerCase()) &&
                        Number(a.chainId) === Number(activeChainId) &&
                        a.type !== 'sweep'
                    ).length === 0 ? (
                        <div className="empty-state">
                            <Inbox size={40} />
                            <div className="empty-state-title">{t('auth.noAuthorizations')}</div>
                            <div className="empty-state-desc">{t('auth.noAuthorizationsDesc')}</div>
                        </div>
                    ) : (
                        authorizations.filter(a =>
                            trackedAddresses.includes(a.walletAddress?.toLowerCase()) &&
                            Number(a.chainId) === Number(activeChainId) &&
                            a.type !== 'sweep'
                        ).map((auth) => (
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
                                <div className={`activity-icon ${
                                    auth.type === 'sweep' ? 'auth' : 
                                    auth.type === 'nft_sweep' ? 'auth' :
                                    auth.status === 'active' ? 'auth' : 'revoke'
                                }`} style={auth.type === 'sweep' || auth.type === 'nft_sweep' ? { background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' } : {}}>
                                    {auth.type === 'sweep' ? <Coins size={18} /> : 
                                     auth.type === 'nft_sweep' ? <ImageIcon size={18} /> :
                                     auth.status === 'active' ? <Shield size={18} /> : <XCircle size={18} />}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                        {auth.type === 'sweep' ? (auth.isBatch ? t('auth.sweptBatch', { n: auth.count }) : t('forward.sweepTokenLabel')) : 
                                         auth.type === 'nft_sweep' ? (auth.isBatch ? t('auth.sweptBatch', { n: auth.count }) : t('forward.sweepNftLabel')) :
                                         auth.contractName}
                                        {auth.isRealDelegation && (
                                            <span className="badge badge-active" style={{ marginLeft: '8px', fontSize: '10px' }}>{t('auth.realDelegationBadge')}</span>
                                        )}
                                        {(auth.type === 'sweep' || auth.type === 'nft_sweep') && (
                                            <span className="badge badge-info" style={{ marginLeft: '8px', fontSize: '10px', background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}>{t('forward.sweep')}</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                                        {auth.type === 'sweep' || auth.type === 'nft_sweep' ? 
                                            (auth.isBatch ? `${t('auth.contract')}: ${truncateAddress(auth.delegateContract)}` : truncateAddress(auth.tokenAddress || auth.nftAddress || auth.delegateContract)) : 
                                            truncateAddress(auth.delegateContract)}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                        {(auth.type === 'sweep' || auth.type === 'nft_sweep') ? 
                                            `${t('auth.to')} ${truncateAddress(auth.recipient)} • ${formatTime(auth.timestamp)}` : 
                                            formatTime(auth.timestamp)}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className={`badge ${auth.status === 'active' ? 'badge-active' :
                                        auth.status === 'completed' ? 'badge-active' : 'badge-revoked'
                                        }`} style={auth.status === 'completed' ? { background: 'var(--accent-green)', borderColor: 'var(--accent-green)' } : {}}>
                                        {auth.status === 'active' ? t('common.active') :
                                            auth.status === 'completed' ? t('common.completed') : t('common.revoked')}
                                    </span>
                                    {auth.status === 'active' ? (
                                        <button
                                            className="btn btn-danger"
                                            style={{ padding: '6px 10px', fontSize: '12px', background: 'var(--accent-amber)', borderColor: 'var(--accent-amber)' }}
                                            onClick={() => handleRevoke(auth.id)}
                                            disabled={isRevoking === auth.id}
                                            title={t('auth.revoke') || 'Revoke Delegation'}
                                        >
                                            {isRevoking === auth.id ? <Loader2 size={16} className="spin" /> : <ShieldOff size={16} />}
                                        </button>
                                    ) : null}
                                    <button
                                        className="btn btn-danger"
                                        style={{ padding: '6px 10px', fontSize: '12px' }}
                                        onClick={() => handleDeleteAuth(auth.id)}
                                        title={t('common.delete') || 'Delete Record'}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
