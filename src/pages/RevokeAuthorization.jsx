import React, { useState, useEffect } from 'react';
import { ShieldOff, Shield, Search, Loader2, AlertTriangle, CheckCircle, XCircle, Trash2, Key, Zap, ExternalLink, Info, Table, History, RefreshCcw, RefreshCw, Fuel } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';
import { getAccountApprovals, revokeTokenApproval } from '../services/approvalService';
import { revokeAuthorization, authorizeContract, getPublicClient } from '../services/eip7702';
import { truncateAddress } from '../services/wallet';
import toast from 'react-hot-toast';
import { parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export default function RevokeAuthorization() {
    const { isConnected, address, chainId, disconnectedChainId } = useWallet();
    const { t } = useI18n();

    // EIP-7702 State
    const [activeDelegation, setActiveDelegation] = useState(null);
    const [isDelegatedAccount, setIsDelegatedAccount] = useState(false);
    const [delegateAddress, setDelegateAddress] = useState(null);
    const [isCheckingEip7702, setIsCheckingEip7702] = useState(false);
    const [isRevokingEip7702, setIsRevokingEip7702] = useState(false);

    // Approval State
    const [approvals, setApprovals] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [revokeStatus, setRevokeStatus] = useState({}); // { key: 'pending' | 'success' | 'error' }
    
    // Global/Manual State
    const [globalSponsorKey, setGlobalSponsorKey] = useState('');
    const [walletPrivateKey, setWalletPrivateKey] = useState('');
    const [manualToken, setManualToken] = useState('');
    const [manualSpender, setManualSpender] = useState('');
    const [manualType, setManualType] = useState('ERC20');
    const [showSponsorKey, setShowSponsorKey] = useState(null); // Local key for individual items if needed
    const [effectiveAddress, setEffectiveAddress] = useState(address);
    const [manualEipContract, setManualEipContract] = useState('');
    const [isAuthorizingEip7702, setIsAuthorizingEip7702] = useState(false);

    useEffect(() => {
        let currentAddress = address;
        if (walletPrivateKey && walletPrivateKey.trim()) {
            try {
                const trimmedKey = walletPrivateKey.trim();
                const formattedKey = trimmedKey.startsWith('0x') ? trimmedKey : `0x${trimmedKey}`;
                const account = privateKeyToAccount(formattedKey);
                currentAddress = account.address;
            } catch (e) {
                // Ignore invalid key for address derivation
            }
        }
        setEffectiveAddress(currentAddress);
    }, [address, walletPrivateKey]);

    const activeChainId = isConnected ? chainId : (disconnectedChainId || 11155111);

    useEffect(() => {
        if (effectiveAddress) {
            console.log(`[RevokeAuthorization] Auto-scanning for ${effectiveAddress} on Chain ${activeChainId}`);
            
            // Clear previous states to show loading/empty for the new address
            setApprovals([]);
            setActiveDelegation(null);
            setIsDelegatedAccount(false);
            setDelegateAddress(null);
            
            checkActiveDelegation(effectiveAddress, activeChainId);
            handleScan(effectiveAddress, activeChainId);
        } else {
            setApprovals([]);
            setActiveDelegation(null);
            setIsDelegatedAccount(false);
        }
    }, [effectiveAddress, activeChainId]);

    const checkActiveDelegation = async (targetAddress, targetChainId) => {
        const addr = targetAddress || effectiveAddress || address;
        const cId = targetChainId || activeChainId;
        if (!addr) return;
        
        setIsCheckingEip7702(true);
        console.log(`[RevokeAuthorization] Checking delegation for ${addr} on chain ${cId}...`);
        try {
            const publicClient = getPublicClient(cId);
            
            // 1. Check bytecode (EIP-7702 or contract)
            const code = await publicClient.getBytecode({ address: addr });
            const hasCode = code && code.length > 2;
            console.log(`[RevokeAuthorization] Bytecode result for ${addr} on chain ${cId}: ${code ? code.substring(0, 10) + '...' : 'null'}, Length: ${code ? code.length : 0}`);
            setIsDelegatedAccount(hasCode);
            
            // Extract delegate address if EIP-7702 (ef01 format)
            if (code && code.startsWith('0xef01')) {
                const extracted = '0x' + code.substring(6, 46);
                setDelegateAddress(extracted);
            } else if (hasCode) {
                // Standard contract or other code
                setDelegateAddress(null);
            } else {
                setDelegateAddress(null);
            }

            // 2. Try forwarder config
            const abi = parseAbi(['function getConfig() view returns (address, address, bool, bool, address)']);
            const result = await publicClient.readContract({
                address: addr,
                abi: abi,
                functionName: 'getConfig'
            }).catch(() => null);

            if (result && result[3]) { // result[3] is initialized
                setActiveDelegation({
                    forwardTarget: result[0],
                    gasSponsor: result[1],
                    autoForward: result[2],
                    emergencyRescue: result[4]
                });
            } else {
                setActiveDelegation(null);
            }
        } catch (e) {
            console.error('Failed to check EIP-7702 status:', e);
            setActiveDelegation(null);
        } finally {
            setIsCheckingEip7702(false);
        }
    };

    const handleScan = async (targetAddress, targetChainId) => {
        // If targetAddress is a React event, ignore it
        const actualAddr = (targetAddress && typeof targetAddress === 'string') ? targetAddress : effectiveAddress;
        const actualChainId = (targetChainId && typeof targetChainId === 'number') ? targetChainId : activeChainId;
        
        if (!actualAddr) return;
        console.log(`[RevokeAuthorization] Scanning approvals for ${actualAddr} on chain ${actualChainId}`);
        setIsScanning(true);
        try {
            const found = await getAccountApprovals(actualAddr, actualChainId);
            setApprovals(found);
            if (found.length === 0) {
                toast(t('revoke.noApprovals'), { icon: 'ℹ️' });
            } else {
                toast.success(t('revoke.foundApprovals', { n: found.length }));
            }
        } catch (error) {
            console.error('Scan failed:', error);
            toast.error(t('forward.nodeRejectError') || 'Failed to scan approvals');
        } finally {
            setIsScanning(false);
        }
    };

    const validateWalletKey = (key) => {
        if (!key) return true;
        try {
            const formattedKey = key.startsWith('0x') ? key : `0x${key}`;
            const account = privateKeyToAccount(formattedKey);
            return true;
        } catch (e) {
            toast.error('Invalid private key format.');
            return false;
        }
    };

    const handleRevokeEip7702 = async (useSponsorship = false) => {
        if (useSponsorship && !globalSponsorKey) {
            toast.error(t('revoke.sponsorKeyRequired'));
            return;
        }

        if (!validateWalletKey(walletPrivateKey)) return;

        setIsRevokingEip7702(true);
        try {
            // If sponsored, we'd need a specific implementation for 'resetting code' via sponsoredExecute
            // For now, EIP-7702 revocation is usually a standard signature-based tx to 0x0 address code
            // But we can support sponsored if our forwarder has a function for it or we send a specific intent.
            // Current revokeAuthorization in eip7702.js is standard.
            await revokeAuthorization({ 
                account: effectiveAddress, 
                chainId: activeChainId,
                sponsorPrivateKey: useSponsorship ? globalSponsorKey : null,
                walletPrivateKey: walletPrivateKey
            });
            toast.success(t('revoke.revokeSuccess'));
            checkActiveDelegation(effectiveAddress, activeChainId);
        } catch (error) {
            console.error('Revocation failed:', error);
            toast.error(error.shortMessage || error.message);
        } finally {
            setIsRevokingEip7702(false);
        }
    };

    const handleAuthorizeEip7702 = async (useSponsorship = false) => {
        if (!manualEipContract) {
            toast.error(t('auth.customAddressPlaceholder') || 'Please enter a contract address');
            return;
        }

        if (useSponsorship && !globalSponsorKey) {
            toast.error(t('revoke.sponsorKeyRequired'));
            return;
        }

        if (!validateWalletKey(walletPrivateKey)) return;

        setIsAuthorizingEip7702(true);
        try {
            await authorizeContract({ 
                account: effectiveAddress, 
                contractAddress: manualEipContract,
                chainId: activeChainId,
                sponsorPrivateKey: useSponsorship ? globalSponsorKey : null,
                walletPrivateKey: walletPrivateKey
            });
            toast.success(t('revoke.authSuccess'));
            setManualEipContract('');
            checkActiveDelegation(effectiveAddress, activeChainId);
        } catch (error) {
            console.error('Authorization failed:', error);
            toast.error(error.shortMessage || error.message);
        } finally {
            setIsAuthorizingEip7702(false);
        }
    };

    const handleRevokeApproval = async (approval, useSponsorship = false) => {
        const key = `${approval.tokenAddress}-${approval.spender}`;
        const finalSponsorKey = useSponsorship ? globalSponsorKey : null;

        if (useSponsorship && !finalSponsorKey) {
            toast.error(t('revoke.sponsorKeyRequired'));
            return;
        }

        if (!validateWalletKey(walletPrivateKey)) return;

        setRevokeStatus({ ...revokeStatus, [key]: 'pending' });
        try {
            await revokeTokenApproval({
                walletAddress: effectiveAddress,
                tokenAddress: approval.tokenAddress,
                spender: approval.spender,
                type: approval.type,
                chainId: activeChainId,
                sponsorPrivateKey: finalSponsorKey,
                walletPrivateKey: walletPrivateKey
            });
            setRevokeStatus({ ...revokeStatus, [key]: 'success' });
            toast.success(t('revoke.revokeSuccess'));
            // Refresh list
            handleScan(effectiveAddress, activeChainId);
        } catch (error) {
            console.error('Revocation failed:', error);
            setRevokeStatus({ ...revokeStatus, [key]: 'error' });
            
            // Helpful error mapping
            if (error.message?.includes('not delegated')) {
                toast.error(t('revoke.notDelegatedError'));
            } else if (error.message?.includes('reverted')) {
                toast.error(t('gas.executeError', { msg: 'Execution reverted. Ensure your account is delegated to a contract that exists on this chain and the sponsor has sufficient ETH.' }));
            } else {
                toast.error(error.shortMessage || error.message);
            }
        }
    };

    const handleManualRevoke = async (useSponsorship = false) => {
        if (!manualToken || !manualSpender) {
            toast.error(t('revoke.inputAddressRequired'));
            return;
        }
        
        const finalSponsorKey = useSponsorship ? globalSponsorKey : null;
        if (useSponsorship && !finalSponsorKey) {
            toast.error(t('revoke.sponsorKeyRequired'));
            return;
        }

        if (!validateWalletKey(walletPrivateKey)) return;

        const key = 'manual';
        setRevokeStatus({ ...revokeStatus, [key]: 'pending' });
        try {
            await revokeTokenApproval({
                walletAddress: effectiveAddress,
                tokenAddress: manualToken,
                spender: manualSpender,
                type: manualType,
                chainId: activeChainId,
                sponsorPrivateKey: finalSponsorKey,
                walletPrivateKey: walletPrivateKey
            });
            toast.success(t('revoke.revokeSuccess'));
            setManualToken('');
            setManualSpender('');
            handleScan(effectiveAddress, activeChainId);
        } catch (error) {
            console.error('Manual revocation failed:', error);
            if (error.message?.includes('not delegated')) {
                toast.error(t('revoke.notDelegatedError'));
            } else {
                toast.error(error.shortMessage || error.message);
            }
        } finally {
            setRevokeStatus({ ...revokeStatus, [key]: 'idle' });
        }
    };

    return (
        <div className="revoke-page">
            <div className="page-header" style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ShieldOff size={32} className="text-secondary" />
                    {t('revoke.title')}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>{t('revoke.subtitle')}</p>
                
                {effectiveAddress && (
                    <div style={{ 
                        marginTop: '16px',
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        padding: '12px 16px', 
                        background: 'rgba(59, 130, 246, 0.05)', 
                        border: '1px solid rgba(59, 130, 246, 0.1)',
                        borderRadius: '12px', 
                        width: 'fit-content' 
                    }}>
                        <Shield size={20} style={{ color: 'var(--accent-blue)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                                {t('revoke.managingAddress')}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="mono" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {effectiveAddress}
                                </span>
                                {walletPrivateKey && (
                                    <span className="badge" style={{ 
                                        fontSize: '10px', 
                                        background: 'rgba(34, 197, 94, 0.1)', 
                                        color: 'var(--accent-green)',
                                        border: '1px solid rgba(34, 197, 94, 0.2)',
                                        padding: '2px 6px'
                                    }}>
                                        {t('revoke.localKeyUsed')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Global Sponsor Settings Card */}
            <div className="grid-2" style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '24px', 
                marginBottom: '32px', 
                alignItems: 'stretch' 
            }}>
                {/* Account Settings Card */}
                <div className="card" style={{ 
                    borderColor: 'var(--accent-blue)', 
                    background: 'rgba(15, 22, 45, 0.95)', 
                    backdropFilter: 'none',
                    margin: 0
                }}>
                    <div className="card-header" style={{ background: 'rgba(59, 130, 246, 0.03)' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Shield size={20} style={{ color: 'var(--accent-blue)' }} />
                            {t('revoke.accountSettingsTitle')}
                        </h3>
                    </div>
                    <div className="card-body">
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                            {t('revoke.accountSettingsDesc')}
                        </p>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <div className="input-with-icon">
                                <Key className="input-icon" size={18} />
                                <input 
                                    type="password"
                                    className="form-input mono"
                                    placeholder={t('revoke.walletPrivateKeyPlaceholder')}
                                    value={walletPrivateKey}
                                    onChange={(e) => setWalletPrivateKey(e.target.value)}
                                    style={{ paddingLeft: '44px' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Gas Sponsor Settings Card */}
                <div className="card" style={{ 
                    borderColor: 'var(--accent-green)', 
                    background: 'rgba(15, 22, 45, 0.95)', 
                    backdropFilter: 'none',
                    margin: 0
                }}>
                    <div className="card-header" style={{ background: 'rgba(34, 197, 94, 0.03)' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Fuel size={20} style={{ color: 'var(--accent-green)' }} />
                            {t('revoke.globalSponsorTitle')}
                        </h3>
                    </div>
                    <div className="card-body">
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                            {t('revoke.globalSponsorDesc')}
                        </p>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div className="input-with-icon">
                                <Key className="input-icon" size={18} />
                                <input 
                                    type="password"
                                    className="form-input mono"
                                    placeholder={t('revoke.sponsorPrivateKeyPlaceholder')}
                                    value={globalSponsorKey}
                                    onChange={(e) => setGlobalSponsorKey(e.target.value)}
                                    style={{ paddingLeft: '44px' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid-2" style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '24px', 
                marginBottom: '40px', 
                alignItems: 'stretch' 
            }}>
                {/* EIP-7702 Section */}
                <div className="card" style={{ background: 'rgba(15, 22, 45, 0.95)', backdropFilter: 'none', margin: 0 }}>
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                            <Zap size={20} style={{ color: 'var(--accent-green)' }} />
                            {t('revoke.eip7702Title')}
                        </h3>
                        {effectiveAddress && (
                            <button 
                                className="btn btn-icon btn-glass" 
                                onClick={() => checkActiveDelegation()}
                                disabled={isCheckingEip7702}
                                title={t('common.refresh')}
                            >
                                <RefreshCw size={16} className={isCheckingEip7702 ? 'spin' : ''} />
                            </button>
                        )}
                    </div>
                    <div className="card-body">
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
                            {t('revoke.eip7702Desc')}
                        </p>

                        {effectiveAddress && activeChainId !== 11155111 && activeChainId !== 17000 && activeChainId !== 1 && (
                            <div className="alert alert-warning" style={{ marginBottom: '20px', padding: '12px', border: '1px solid var(--accent-amber)', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '8px', color: 'var(--accent-amber)', fontSize: '13px' }}>
                                <AlertTriangle size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                {t('deploy.networkWarning')}
                            </div>
                        )}

                        {!effectiveAddress ? (
                            <div className="empty-state" style={{ padding: '20px' }}>
                                <Shield size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>
                                    {isConnected ? t('revoke.detectingEoa') : t('revoke.accountSettingsDesc')}
                                </p>
                            </div>
                        ) : isCheckingEip7702 ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                                <Loader2 size={24} className="spin text-secondary" />
                            </div>
                        ) : activeDelegation || isDelegatedAccount ? (
                            <div className="active-delegation-box" style={{ 
                                background: 'rgba(34, 197, 94, 0.05)', 
                                border: '1px solid rgba(34, 197, 94, 0.2)',
                                borderRadius: '12px',
                                padding: '20px'
                            }}>
                                <div style={{ marginBottom: '16px' }}>
                                    <span className="badge badge-active" style={{ marginBottom: '8px', display: 'inline-block' }}>
                                        {isDelegatedAccount ? t('revoke.isDelegated') : t('revoke.activeDelegation')}
                                    </span>
                                    <div style={{ fontSize: '16px', fontWeight: 600 }}>{truncateAddress(delegateAddress || effectiveAddress)}</div>
                                </div>
                                
                                {activeDelegation && (
                                    <div className="info-grid" style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div style={{ fontSize: '12px' }}>
                                            <div style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>{t('forward.currentTarget')}</div>
                                            <div className="mono">{truncateAddress(activeDelegation.forwardTarget)}</div>
                                        </div>
                                        <div style={{ fontSize: '12px' }}>
                                            <div style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>{t('forward.currentSponsor')}</div>
                                            <div className="mono">{truncateAddress(activeDelegation.gasSponsor) || t('forward.none')}</div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button 
                                        className="btn btn-danger btn-sm" 
                                        style={{ flex: 1 }}
                                        onClick={() => handleRevokeEip7702(false)}
                                        disabled={isRevokingEip7702}
                                    >
                                        {isRevokingEip7702 ? <Loader2 size={16} className="spin" /> : <ShieldOff size={16} />}
                                        {t('revoke.revokeStandard')}
                                    </button>
                                    <button 
                                        className="btn btn-secondary btn-sm" 
                                        style={{ 
                                            flex: 1, 
                                            borderColor: 'var(--accent-green)', 
                                            color: 'var(--accent-green)'
                                        }}
                                        onClick={() => handleRevokeEip7702(true)}
                                        disabled={isRevokingEip7702}
                                    >
                                        <Zap size={16} />
                                        {t('revoke.revokeSponsored')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="active-delegation-box" style={{ 
                                background: 'rgba(59, 130, 246, 0.05)', 
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                borderRadius: '12px',
                                padding: '20px',
                                textAlign: 'center'
                            }}>
                                <Shield className="text-secondary" size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                <div style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                    {t('revoke.isStandardEoa')}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                                    <div>Address: <span className="mono">{effectiveAddress}</span></div>
                                    <div>Chain ID: <span className="mono">{activeChainId}</span></div>
                                </div>
                                <button 
                                    className="btn btn-glass btn-sm"
                                    onClick={() => checkActiveDelegation()}
                                    disabled={isCheckingEip7702}
                                    style={{ width: 'auto', margin: '0 auto' }}
                                >
                                    <RefreshCw size={14} className={isCheckingEip7702 ? 'spin' : ''} style={{ marginRight: '6px' }} />
                                    {t('common.refresh')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Manual EIP-7702 Authorization Section */}
                <div className="card" style={{ background: 'rgba(15, 22, 45, 0.95)', backdropFilter: 'none', margin: 0 }}>
                    <div className="card-header">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Shield size={20} className="text-secondary" />
                            {t('revoke.manualAuthTitle')}
                        </h3>
                    </div>
                    <div className="card-body">
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
                            {t('revoke.manualAuthDesc')}
                        </p>
                        
                        <div className="form-group">
                            <label className="form-label">{t('auth.delegateContract')}</label>
                            <input 
                                className="form-input mono"
                                placeholder="0x..."
                                value={manualEipContract}
                                onChange={(e) => setManualEipContract(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                            <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ flex: 1 }}
                                onClick={() => handleAuthorizeEip7702(false)}
                                disabled={isAuthorizingEip7702}
                            >
                                {isAuthorizingEip7702 ? <Loader2 size={16} className="spin" /> : t('revoke.authorizeStandard')}
                            </button>
                            <button 
                                className="btn btn-primary btn-sm" 
                                style={{ flex: 1 }}
                                onClick={() => handleAuthorizeEip7702(true)}
                                disabled={isAuthorizingEip7702}
                            >
                                <Zap size={16} />
                                {isAuthorizingEip7702 ? <Loader2 size={16} className="spin" /> : t('revoke.authorizeSponsored')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid-2" style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '24px', 
                marginBottom: '40px', 
                alignItems: 'stretch' 
            }}>
                {/* Manual Revoke Section */}
                <div className="card" style={{ background: 'rgba(15, 22, 45, 0.95)', backdropFilter: 'none', margin: 0 }}>
                    <div className="card-header">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Trash2 size={20} className="text-secondary" />
                            {t('revoke.manualRevokeTitle')}
                        </h3>
                    </div>
                    <div className="card-body">
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
                            {t('revoke.manualRevokeDesc')}
                        </p>
                        
                        <div className="form-group">
                            <label className="form-label">{t('revoke.tokenAddress')}</label>
                            <input 
                                className="form-input mono"
                                placeholder="0x..."
                                value={manualToken}
                                onChange={(e) => setManualToken(e.target.value)}
                            />
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label">{t('revoke.spenderAddress')}</label>
                            <input 
                                className="form-input mono"
                                placeholder="0x..."
                                value={manualSpender}
                                onChange={(e) => setManualSpender(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                    <input type="radio" name="manualType" checked={manualType === 'ERC20'} onChange={() => setManualType('ERC20')} />
                                    ERC20
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                    <input type="radio" name="manualType" checked={manualType === 'NFT'} onChange={() => setManualType('NFT')} />
                                    NFT (ApprovalForAll)
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                            <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ flex: 1 }}
                                onClick={() => handleManualRevoke(false)}
                                disabled={revokeStatus.manual === 'pending'}
                            >
                                {t('revoke.revokeStandard')}
                            </button>
                            <button 
                                className="btn btn-primary btn-sm" 
                                style={{ flex: 1 }}
                                onClick={() => handleManualRevoke(true)}
                                disabled={revokeStatus.manual === 'pending'}
                            >
                                <Zap size={16} />
                                {t('revoke.revokeSponsored')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Historical Approvals Section */}
            <div className="card" style={{ background: 'var(--bg-card)', backdropFilter: 'none', position: 'relative', zIndex: 1 }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <History size={20} className="text-secondary" />
                        {t('revoke.approvalTitle')}
                    </h3>
                    <button 
                        className="btn btn-primary" 
                        onClick={() => handleScan()} 
                        disabled={isScanning || !effectiveAddress}
                    >
                        {isScanning ? <Loader2 size={18} className="spin" /> : <Search size={18} />}
                        {t('revoke.scanApprovals')}
                    </button>
                </div>
                <div className="card-body">
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
                        {t('revoke.approvalDesc')}
                    </p>

                    <div className="alert alert-warning" style={{ marginBottom: '24px' }}>
                        <AlertTriangle size={18} />
                        <span>{t('revoke.infoAlertApproval')}</span>
                    </div>

                    {!effectiveAddress ? (
                        <div className="empty-state" style={{ padding: '60px' }}>
                            <Table size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                            <p style={{ color: 'var(--text-tertiary)' }}>{t('revoke.accountSettingsDesc')}</p>
                        </div>
                    ) : isScanning ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px' }}>
                            <Loader2 size={40} className="spin text-secondary" style={{ marginBottom: '16px' }} />
                            <p style={{ color: 'var(--text-secondary)' }}>{t('revoke.scanning')}</p>
                        </div>
                    ) : approvals.length > 0 ? (
                        <div className="table-container" style={{ overflowX: 'auto' }}>
                            <table className="approval-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0' }}>
                                <thead>
                                    <tr>
                                        <th style={tableHeaderStyle}>{t('revoke.token')}</th>
                                        <th style={tableHeaderStyle}>{t('revoke.spender')}</th>
                                        <th style={tableHeaderStyle}>{t('revoke.allowance')}</th>
                                        <th style={tableHeaderStyle}>{t('revoke.lastUpdated')}</th>
                                        <th style={tableHeaderStyle}>{t('revoke.action')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {approvals.map((app) => {
                                        const key = `${app.tokenAddress}-${app.spender}`;
                                        const isRevoking = revokeStatus[key] === 'pending';
                                        
                                        return (
                                            <tr key={key} className="activity-item-hover">
                                                <td style={tableCellStyle}>
                                                    <div style={{ fontWeight: 600 }}>{app.symbol}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{truncateAddress(app.tokenAddress)}</div>
                                                </td>
                                                <td style={tableCellStyle}>
                                                    <div className="mono" style={{ fontSize: '13px' }}>{truncateAddress(app.spender)}</div>
                                                </td>
                                                <td style={tableCellStyle}>
                                                    <span className="badge badge-info" style={{ 
                                                        fontSize: '11px', 
                                                        background: app.allowance === 'ALL' || app.allowance.length > 10 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                        color: app.allowance === 'ALL' || app.allowance.length > 10 ? '#ef4444' : '#3b82f6',
                                                        borderColor: 'transparent'
                                                    }}>
                                                        {app.allowance === 'ALL' ? t('revoke.unlimited') : app.allowance.length > 10 ? t('revoke.unlimited') : app.allowance}
                                                    </span>
                                                </td>
                                                <td style={tableCellStyle}>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                        {new Date(app.timestamp).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td style={tableCellStyle}>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button 
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => handleRevokeApproval(app, false)}
                                                            disabled={isRevoking}
                                                        >
                                                            {isRevoking ? <Loader2 size={14} className="spin" /> : <RefreshCcw size={14} />}
                                                            {t('revoke.revokeStandard')}
                                                        </button>
                                                        <button 
                                                            className="btn btn-secondary btn-sm"
                                                            style={{ 
                                                                borderColor: 'var(--accent-green)', 
                                                                color: 'var(--accent-green)'
                                                            }}
                                                            onClick={() => handleRevokeApproval(app, true)}
                                                            disabled={isRevoking}
                                                        >
                                                            <Zap size={14} />
                                                            {t('revoke.revokeSponsored')}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: '60px' }}>
                            <Search size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                            <p style={{ color: 'var(--text-secondary)' }}>{t('revoke.noApprovals')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const tableHeaderStyle = {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-glass)'
};

const tableCellStyle = {
    padding: '16px',
    borderBottom: '1px solid var(--border-subtle)',
    verticalAlign: 'middle'
};
