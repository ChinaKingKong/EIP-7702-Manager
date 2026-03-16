import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Send, Zap, RefreshCw, AlertTriangle, CheckCircle, XCircle, Loader2, Search, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPublicClient } from '../services/eip7702';
import { getDeployedContracts } from '../services/deployedContracts';
import { getAccountNFTs } from '../services/ankrIndex';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';
import { truncateAddress } from '../services/wallet';
import { saveAuthorization } from '../services/authorizationCache';
import { createWalletClient, custom, http, encodeFunctionData, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia, holesky } from 'viem/chains';
import { RPC_URLS } from '../config';

const CHAIN_MAP = { 1: mainnet, 11155111: sepolia, 17000: holesky };

export default function NftSweep() {
    const { isConnected, chainId, disconnectedChainId } = useWallet();
    const { t } = useI18n();
    const activeChainId = isConnected ? chainId : disconnectedChainId;

    const [deployedContracts, setDeployedContracts] = useState([]);
    const [selectedContract, setSelectedContract] = useState('');
    const [customContract, setCustomContract] = useState('');
    const contractAddress = selectedContract || customContract;
    const [privateKey, setPrivateKey] = useState('');
    const [sweepSponsorKey, setSweepSponsorKey] = useState('');
    const [sweepRecipient, setSweepRecipient] = useState('');

    const [discoveredNfts, setDiscoveredNfts] = useState([]);
    const [imageErrors, setImageErrors] = useState({});
    const [isScanningNfts, setIsScanningNfts] = useState(false);
    const [isSweeping, setIsSweeping] = useState(false); // Current sweeping NFT address or 'batch'
    const [isSweepingInProgress, setIsSweepingInProgress] = useState(false); // Match AutoForwarder behavior
    const [sweepError, setSweepError] = useState('');

    // Manual sweep state
    const [manualNftAddress, setManualNftAddress] = useState('');
    const [manualTokenId, setManualTokenId] = useState('');

    useEffect(() => {
        const contracts = getDeployedContracts().filter(c => Number(c.chainId) === Number(activeChainId));
        setDeployedContracts(contracts);
        if (contracts.length > 0) {
            setSelectedContract((prev) => prev || contracts[0].address);
        } else {
            setSelectedContract('');
        }
    }, [activeChainId]);

    const handleScanNfts = async () => {
        setIsScanningNfts(true);
        setSweepError('');
        setDiscoveredNfts([]);
        setImageErrors({});
        try {
            let pk = privateKey.trim();
            if (pk && !pk.startsWith('0x')) pk = '0x' + pk;
            if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) throw new Error(t('forward.pkRequiredHint'));
            
            const targetAddress = privateKeyToAccount(pk).address;
            const nfts = await getAccountNFTs(targetAddress, activeChainId);
            setDiscoveredNfts(nfts);
            if (nfts.length === 0) {
                toast.success(t('forward.noNftsFound'));
            } else {
                toast.success(t('forward.nftsFound', { n: nfts.length }));
            }
        } catch (err) {
            setSweepError(err.message);
            toast.error(err.message);
        } finally {
            setIsScanningNfts(false);
        }
    };

    const handleSweepNft = async (nftContract, tokenId) => {
        setIsSweeping(`${nftContract}-${tokenId}`);
        setIsSweepingInProgress(true);
        setSweepError('');
        try {
            const recipient = sweepRecipient.trim();
            if (!recipient || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) throw new Error(t('forward.sweepNftRecipientPlaceholder'));
            
            let pk = privateKey.trim();
            if (pk && !pk.startsWith('0x')) pk = '0x' + pk;
            const account = privateKeyToAccount(pk);
            
            let sk = sweepSponsorKey.trim();
            if (sk && !sk.startsWith('0x')) sk = '0x' + sk;
            const sponsorAccount = privateKeyToAccount(sk);

            const rpcUrl = RPC_URLS[activeChainId] || RPC_URLS[11155111];
            const chain = CHAIN_MAP[activeChainId] || sepolia;
            const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
            const sponsorClient = createWalletClient({ account: sponsorAccount, chain, transport: http(rpcUrl) });
            const userWalletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

            toast.loading(t('forward.sweeping'), { id: 'nft-sweep-loading' });

            const currentNonce = await publicClient.getTransactionCount({ address: account.address });
            const authorization = await userWalletClient.signAuthorization({
                account,
                contractAddress,
                chainId: activeChainId,
                nonce: currentNonce,
            });

            // Ensure compatibility with different viem versions
            const finalAuth = {
                ...authorization,
                contractAddress: authorization.contractAddress || authorization.address,
                address: authorization.address || authorization.contractAddress,
            };

            const callData = encodeFunctionData({
                abi: [{
                    name: 'sweepNftTo', type: 'function', stateMutability: 'nonpayable',
                    inputs: [{ name: 'nft', type: 'address' }, { name: 'tokenId', type: 'uint256' }, { name: 'to', type: 'address' }],
                    outputs: [],
                }],
                functionName: 'sweepNftTo',
                args: [nftContract, BigInt(tokenId), recipient],
            });

            const hash = await sponsorClient.sendTransaction({
                authorizationList: [finalAuth],
                to: account.address,
                data: callData,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 600_000 });
            
            if (receipt.status === 'success') {
                toast.success(t('forward.sweepSuccess'), { id: 'nft-sweep-loading' });
                saveAuthorization({
                    id: `nft-sweep-${Date.now()}`,
                    walletAddress: account.address,
                    delegateContract: contractAddress,
                    chainId: Number(activeChainId),
                    status: 'completed',
                    timestamp: Date.now(),
                    txHash: hash,
                    type: 'nft_sweep',
                    nftAddress: nftContract,
                    tokenId: tokenId.toString(),
                    recipient: recipient
                });
                handleScanNfts();
            } else {
                throw new Error('NFT 转移失败：交易已撤回');
            }
        } catch (err) {
            setSweepError(err.message);
            toast.error(err.message, { id: 'nft-sweep-loading' });
        } finally {
            setIsSweeping(false);
            setIsSweepingInProgress(false);
        }
    };

    const handleBatchSweepNfts = async () => {
        setIsSweeping('batch');
        setIsSweepingInProgress(true);
        setSweepError('');
        try {
            const recipient = sweepRecipient.trim();
            if (!recipient || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) throw new Error(t('forward.sweepNftRecipientPlaceholder'));
            
            const nfts = discoveredNfts.map(n => n.contractAddress);
            const ids = discoveredNfts.map(n => BigInt(n.tokenId));
            
            let pk = privateKey.trim();
            if (pk && !pk.startsWith('0x')) pk = '0x' + pk;
            const account = privateKeyToAccount(pk);
            
            let sk = sweepSponsorKey.trim();
            if (sk && !sk.startsWith('0x')) sk = '0x' + sk;
            const sponsorAccount = privateKeyToAccount(sk);

            const rpcUrl = RPC_URLS[activeChainId] || RPC_URLS[11155111];
            const chain = CHAIN_MAP[activeChainId] || sepolia;
            const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
            const sponsorClient = createWalletClient({ account: sponsorAccount, chain, transport: http(rpcUrl) });
            const userWalletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

            toast.loading(t('forward.sweeping'), { id: 'nft-batch-sweep-loading' });

            const currentNonce = await publicClient.getTransactionCount({ address: account.address });
            const authorization = await userWalletClient.signAuthorization({
                account,
                contractAddress,
                chainId: activeChainId,
                nonce: currentNonce,
            });

            const finalAuth = {
                ...authorization,
                contractAddress: authorization.contractAddress || authorization.address,
                address: authorization.address || authorization.contractAddress,
            };

            const callData = encodeFunctionData({
                abi: [{
                    name: 'sweepNftsTo', type: 'function', stateMutability: 'nonpayable',
                    inputs: [{ name: 'nfts', type: 'address[]' }, { name: 'tokenIds', type: 'uint256[]' }, { name: 'to', type: 'address' }],
                    outputs: [],
                }],
                functionName: 'sweepNftsTo',
                args: [nfts, ids, recipient],
            });

            const hash = await sponsorClient.sendTransaction({
                authorizationList: [finalAuth],
                to: account.address,
                data: callData,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 600_000 });
            
            if (receipt.status === 'success') {
                toast.success(t('forward.sweepSuccess'), { id: 'nft-batch-sweep-loading' });
                saveAuthorization({
                    id: `nft-batch-sweep-${Date.now()}`,
                    walletAddress: account.address,
                    delegateContract: contractAddress,
                    chainId: Number(activeChainId),
                    status: 'completed',
                    timestamp: Date.now(),
                    txHash: hash,
                    type: 'nft_sweep',
                    recipient: recipient,
                    isBatch: true,
                    count: nfts.length
                });
                handleScanNfts();
            } else {
                throw new Error('批量 NFT 转移失败：交易已撤回');
            }
        } catch (err) {
            setSweepError(err.message);
            toast.error(err.message, { id: 'nft-batch-sweep-loading' });
        } finally {
            setIsSweeping(false);
            setIsSweepingInProgress(false);
        }
    };

    return (
        <div className="page-enter">
            {isSweepingInProgress && createPortal(
                <div className="lang-loading-overlay">
                    <div className="lang-loading-content">
                        <div className="lang-loading-rings">
                            <div className="lang-ring lang-ring-1" />
                            <div className="lang-ring lang-ring-2" />
                            <div className="lang-ring lang-ring-3" />
                        </div>
                        <div className="lang-loading-logo">
                            <img src="/logo.png" alt="Logo" />
                        </div>
                        <div className="lang-loading-text">
                            <Loader2 size={16} className="spin" />
                            <span>{t('forward.sweepingNft') || 'Sweeping NFTs...'}</span>
                        </div>
                        <div className="lang-particles">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="lang-particle" style={{ '--i': i }} />
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="card" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className="card-header" style={{ background: 'var(--bg-glass)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ImageIcon size={20} style={{ color: 'var(--accent-purple)' }} />
                        {t('forward.sweepNftLabel')}
                    </h3>
                </div>
                <div className="card-body">
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="form-label">{t('forward.operationMode')}</label>
                        <input className="form-input mono" type="password" value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} placeholder="0x..." />
                    </div>

                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="form-label">{t('auth.delegateContract')}</label>
                        <input className="form-input mono" list="nft-contracts" value={contractAddress} onChange={(e) => setCustomContract(e.target.value)} />
                        <datalist id="nft-contracts">
                            {deployedContracts.map(c => <option key={c.address} value={c.address}>{c.name}</option>)}
                        </datalist>
                    </div>

                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="form-label">{t('forward.sweepSponsorKeyLabel')}</label>
                        <input className="form-input mono" type="password" value={sweepSponsorKey} onChange={(e) => setSweepSponsorKey(e.target.value)} placeholder="0x..." />
                    </div>

                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="form-label">{t('forward.sweepNftRecipientLabel')}</label>
                        <input className="form-input mono" type="text" value={sweepRecipient} onChange={(e) => setSweepRecipient(e.target.value)} placeholder={t('forward.sweepNftRecipientPlaceholder')} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 600 }}>{t('forward.scanAndSweepNftTitle')}</h4>
                        <button className="btn btn-secondary" onClick={handleScanNfts} disabled={isScanningNfts || !privateKey.trim()}>
                            {isScanningNfts ? <Loader2 size={14} className="spin" /> : <Search size={14} />} {t('forward.scanNftBtn')}
                        </button>
                    </div>

                    {discoveredNfts.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                            {discoveredNfts.length > 1 && (
                                <button className="btn btn-primary" onClick={handleBatchSweepNfts} disabled={isSweeping !== false} style={{ background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}>
                                    <Zap size={16} /> {t('forward.batchSweepNftBtn', { n: discoveredNfts.length })}
                                </button>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                {discoveredNfts.map((nft, i) => {
                                    const nftKey = `${nft.contractAddress}-${nft.tokenId}`;
                                    const hasImageError = imageErrors[nftKey];
                                    return (
                                        <div key={i} className="interactive-card" style={{ padding: '12px', background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
                                            {nft.imageUrl && !hasImageError ? (
                                                <img 
                                                    src={nft.imageUrl} 
                                                    alt={nft.name} 
                                                    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} 
                                                    onError={() => setImageErrors(prev => ({ ...prev, [nftKey]: true }))}
                                                />
                                            ) : (
                                                <div style={{ height: '140px', background: 'var(--bg-subtle)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                                                    <ImageIcon size={32} style={{ color: 'var(--text-tertiary)' }} title="NFT Image Not Available" />
                                                </div>
                                            )}
                                            <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nft.name} #{nft.tokenId}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>{nft.collectionName}</div>
                                            <button className="btn btn-primary btn-full" onClick={() => handleSweepNft(nft.contractAddress, nft.tokenId)} disabled={isSweeping !== false} style={{ padding: '6px', fontSize: '12px', background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}>
                                                {isSweeping === nftKey ? <Loader2 size={12} className="spin" /> : t('forward.sweepNftBtn')}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <hr className="divider" style={{ margin: '24px 0', borderColor: 'var(--border-subtle)' }} />

                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label className="form-label">{t('forward.manualNftSweepLabel')}</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                className="form-input mono"
                                type="text"
                                style={{ flex: 2 }}
                                placeholder={t('forward.nftAddressPlaceholder')}
                                value={manualNftAddress}
                                onChange={(e) => setManualNftAddress(e.target.value)}
                            />
                            <input
                                className="form-input mono"
                                type="text"
                                style={{ flex: 1 }}
                                placeholder={t('forward.nftTokenIdPlaceholder')}
                                value={manualTokenId}
                                onChange={(e) => setManualTokenId(e.target.value)}
                            />
                        </div>
                    </div>

                    <button 
                        className="btn btn-primary btn-full" 
                        onClick={() => handleSweepNft(manualNftAddress, manualTokenId)} 
                        disabled={isSweeping !== false || !manualNftAddress.trim() || !manualTokenId.trim() || !sweepRecipient.trim()} 
                        style={{ background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}
                    >
                        {isSweeping && isSweeping === `${manualNftAddress}-${manualTokenId}` ? (
                            <><Loader2 size={18} className="spin" /> {t('forward.forwarding')}</>
                        ) : (
                            <><Send size={18} /> {t('forward.sweepNftBtn')}</>
                        )}
                    </button>

                    {sweepError && isSweeping === false && (
                        <div className="alert alert-error" style={{ marginTop: '16px' }}>
                            <XCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span style={{ fontSize: '13px' }}>{sweepError}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
