import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Send, Zap, Settings, RefreshCw, AlertTriangle, CheckCircle, XCircle, Loader2, Search, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPublicClient } from '../services/eip7702';
import { getDeployedContracts } from '../services/deployedContracts';
import { getAccountTokens } from '../services/ankrIndex'; 
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';
import { truncateAddress } from '../services/wallet';
import { createWalletClient, custom, http, encodeFunctionData, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia, holesky } from 'viem/chains';
import { RPC_URLS } from '../config';

const CHAIN_MAP = { 1: mainnet, 11155111: sepolia, 17000: holesky };

export default function AutoForward() {
    const { isConnected, chainId, disconnectedChainId } = useWallet();
    const { t } = useI18n();
    const activeChainId = isConnected ? chainId : disconnectedChainId;

    // 状态管理
    const [deployedContracts, setDeployedContracts] = useState([]);
    const [selectedContract, setSelectedContract] = useState('');
    const [customContract, setCustomContract] = useState(''); // 与转发授权一致：可输入或从列表选委托合约
    const contractAddress = selectedContract || customContract;
    const [privateKey, setPrivateKey] = useState('');
    const [sweepSponsorKey, setSweepSponsorKey] = useState('');
    const [sweepRecipient, setSweepRecipient] = useState('');

    // ERC20 Sweep 状态
    const [tokenAddress, setTokenAddress] = useState('');
    const [discoveredTokens, setDiscoveredTokens] = useState([]);
    const [isScanningTokens, setIsScanningTokens] = useState(false);

    // 当前链上配置（仅展示用，搬运时仍实时读链）
    const [onchainConfig, setOnchainConfig] = useState(null);
    const [isLoadingConfig, setIsLoadingConfig] = useState(false);

    // 交互状态
    const [isSweeping, setIsSweeping] = useState(false);
    const [sweepError, setSweepError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [sweeping, setSweeping] = useState(false); // Global full-screen loading state

    // 组件挂载时获取已部署的合约
    useEffect(() => {
        const contracts = getDeployedContracts();
        setDeployedContracts(contracts);
        if (contracts.length > 0) {
            setSelectedContract((prev) => prev || contracts[0].address);
        }
    }, []);

    // Load config helper
    const loadConfig = async (userAddress, rpcUrl = null) => {
        try {
            setIsLoadingConfig(true);

            let publicClient;
            if (rpcUrl) {
                publicClient = createPublicClient({ chain: CHAIN_MAP[chainId] || sepolia, transport: http(rpcUrl) });
            } else {
                publicClient = getPublicClient(chainId);
            }

            const CONFIG_ABI = [{
                name: 'getConfig', type: 'function', stateMutability: 'view',
                inputs: [],
                outputs: [
                    { name: '_forwardTarget', type: 'address' },
                    { name: '_gasSponsor', type: 'address' },
                    { name: '_autoForwardEnabled', type: 'bool' },
                    { name: '_initialized', type: 'bool' },
                ],
            }];

            const result = await publicClient.readContract({
                address: userAddress,
                abi: CONFIG_ABI,
                functionName: 'getConfig',
            });

            setOnchainConfig({
                forwardTarget: result[0],
                gasSponsor: result[1],
                autoForwardEnabled: result[2],
                initialized: result[3],
            });
        } catch (err) {
            console.error("加载配置失败:", err);
            setOnchainConfig(null);
        } finally {
            setIsLoadingConfig(false);
        }
    };

    // 当转出钱包私钥变更时，尝试加载其链上配置（仅用于展示等，搬运时仍实时读链）
    useEffect(() => {
        let pk = privateKey.trim();
        if (pk && !pk.startsWith('0x')) pk = '0x' + pk;
        if (pk && /^0x[0-9a-fA-F]{64}$/.test(pk)) {
            try {
                const account = privateKeyToAccount(pk);
                loadConfig(account.address, RPC_URLS[activeChainId] || RPC_URLS[11155111]);
            } catch (e) {
                // ignore
            }
        } else {
            setOnchainConfig(null);
        }
    }, [privateKey, activeChainId]);

    // 操作：搬运 ERC20 代币
    const handleSweepToken = async (targetToken = null) => {
        const sweepAddr = typeof targetToken === 'string' ? targetToken : tokenAddress;
        setSweepError('');
        setSuccessMessage('');
        setIsSweeping(sweepAddr); // Store the address for the button spinner

        try {
            if (!sweepAddr || !/^0x[a-fA-F0-9]{40}$/.test(sweepAddr)) {
                throw new Error("请输入有效的 ERC20 代币合约地址");
            }

            const recipient = sweepRecipient.trim();
            if (!recipient || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
                throw new Error("请填写有效的代币接收地址（必填）。");
            }

            if (!sweepSponsorKey || !sweepSponsorKey.trim()) {
                throw new Error("请填写 Gas 赞助商私钥（必填），当前仅支持赞助商代付 Gas 搬运。");
            }

            let pk = privateKey.trim();
            if (pk && !pk.startsWith('0x')) pk = '0x' + pk;
            if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
                throw new Error("请填写有效的转出钱包私钥（必填）。");
            }

            const account = privateKeyToAccount(pk);
            const accountAddress = account.address;
            const rpcUrl = RPC_URLS[activeChainId] || RPC_URLS[11155111];
            const chain = CHAIN_MAP[activeChainId] || sepolia;
            const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

            // 可选：使用赞助商私钥，通过 EIP-7702 原生机制代扣 Gas
            let sponsorClient = null;
            let sponsorAddress = null;

            let formattedSponsorKey = sweepSponsorKey.trim();
            if (!formattedSponsorKey.startsWith('0x')) formattedSponsorKey = `0x${formattedSponsorKey}`;
            if (!/^0x[0-9a-fA-F]{64}$/.test(formattedSponsorKey)) {
                throw new Error("赞助商私钥格式无效。");
            }
            const sponsorAccount = privateKeyToAccount(formattedSponsorKey);
            sponsorClient = createWalletClient({
                account: sponsorAccount,
                chain,
                transport: http(rpcUrl),
            });
            sponsorAddress = sponsorAccount.address;

            const sponsorBalance = await publicClient.getBalance({ address: sponsorAddress });
            if (sponsorBalance === 0n) {
                throw new Error('赞助商钱包没有 ETH。请充值 ETH Gas。');
            }

            const finalRecipient = recipient;

            // 实时读取当前转出账户的链上配置，避免依赖可能未就绪或不同账户的 onchainConfig
            const CONFIG_ABI = [{
                name: 'getConfig', type: 'function', stateMutability: 'view',
                inputs: [],
                outputs: [
                    { name: '_forwardTarget', type: 'address' },
                    { name: '_gasSponsor', type: 'address' },
                    { name: '_autoForwardEnabled', type: 'bool' },
                    { name: '_initialized', type: 'bool' },
                ],
            }];
            let configInitialized = false;
            let configGasSponsor = '';
            try {
                const configResult = await publicClient.readContract({
                    address: accountAddress,
                    abi: CONFIG_ABI,
                    functionName: 'getConfig',
                });
                configInitialized = configResult[3];
                configGasSponsor = (configResult[1] || '').toLowerCase();
            } catch (e) {
                console.warn('读取链上配置失败', e);
            }
            if (!configInitialized) {
                throw new Error('操作账户尚未初始化。请先在【转发授权】完成委托并初始化，且将 Gas 代付人 设为当前赞助商地址。');
            }
            const sponsor = (sponsorAddress || '').toLowerCase();
            const zeroAddr = '0x0000000000000000000000000000000000000000';
            if (configGasSponsor !== sponsor) {
                const isChainSponsorEmpty = !configGasSponsor || configGasSponsor === zeroAddr;
                const msg = isChainSponsorEmpty
                    ? `链上 Gas 代付人为空，说明您在【转发授权】时未填写「Gas 赞助商私钥」。请到【转发授权】页填写与当前相同的赞助商私钥（当前赞助商: ${sponsor}）后重新执行一次委托，即可将 Gas 代付人写入链上。`
                    : `链上 Gas 代付人与当前赞助商地址不一致，合约会拒绝调用。链上 Gas 代付人: ${configGasSponsor}，当前赞助商: ${sponsor}。请在【转发授权】用与搬运页相同的赞助商私钥重新执行委托以更新 Gas 代付人，且委托合约选择与搬运页一致。`;
                throw new Error(msg);
            }

            console.log(
                `[Token Sweep] Sponsor: ${sponsorAddress}, Source account: ${accountAddress}, Token destination: ${finalRecipient}`
            );

            const SWEEP_ABI = [{
                name: 'sweepTokenTo', type: 'function', stateMutability: 'nonpayable',
                inputs: [{ name: 'token', type: 'address' }, { name: 'to', type: 'address' }],
                outputs: [],
            }];
            const ERC20_BALANCE_ABI = [{
                name: 'balanceOf', type: 'function', stateMutability: 'view',
                inputs: [{ name: 'account', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }],
            }];

            const tokenBalance = await publicClient.readContract({
                address: sweepAddr,
                abi: ERC20_BALANCE_ABI,
                functionName: 'balanceOf',
                args: [accountAddress],
            });
            if (tokenBalance === 0n) {
                throw new Error('操作账户在该代币上的余额为 0，无需搬运。');
            }

            toast.loading(
                `正在由赞助商代付 Gas，搬运至 ${truncateAddress(finalRecipient)}`,
                { duration: 3000 }
            );

            const hash = await sponsorClient.sendTransaction({
                to: accountAddress,
                data: encodeFunctionData({
                    abi: SWEEP_ABI,
                    functionName: 'sweepTokenTo',
                    args: [sweepAddr, finalRecipient],
                }),
                value: 0n
            });

            setSweeping(true); // Start full-screen loading overlay

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') {
                throw new Error(
                    '交易已上链但执行失败（revert）。常见原因：链上 Gas 代付人与当前赞助商地址不一致、操作账户该代币余额为 0、或接收地址无效。请在【转发授权】初始化时将 Gas 代付人 设为当前赞助商地址后重试。'
                );
            }

            toast.success(t('forward.sweepSuccess') || 'Tokens swept successfully!');

            // Auto-refresh token list after sweep
            setTimeout(() => {
                handleScanTokens();
            }, 1000);

            // Close loading with delay to match index.css animation timing
            setTimeout(() => {
                setSweeping(false);
            }, 1600);

        } catch (err) {
            console.error(err);
            const msg = err.shortMessage || err.message || 'Sweep failed';
            let displayMsg;
            if (msg.includes('External transactions to internal accounts cannot include data')) {
                displayMsg = '节点拒绝了交易：当前账户尚未完成 EIP-7702 委托授权。请先前往左侧【转发授权】页面签署并执行初始委托，或者更换 RPC 节点重试。';
            } else {
                displayMsg = msg || '代币搬运失败，请确认该代币余额不为 0 且 EOA 代理未过期。';
            }
            setSweepError(displayMsg);
            toast.error(displayMsg, { duration: 5000 });
        } finally {
            setIsSweeping(false);
        }
    };

    // 操作：扫描当前钱包的 ERC20 资产
    const handleScanTokens = async () => {
        setIsScanningTokens(true);
        setSweepError('');
        setSuccessMessage('');
        setDiscoveredTokens([]);
        try {
            let pk = privateKey.trim();
            if (pk && !pk.startsWith('0x')) pk = '0x' + pk;
            if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
                throw new Error("请先输入转出钱包私钥以扫描资产。");
            }
            const targetAddress = privateKeyToAccount(pk).address;

            const supportedChains = [1, 11155111, 17000];
            if (!supportedChains.includes(activeChainId)) {
                setSweepError(`当前网络 (Chain ID: ${activeChainId}) 暂时不支持自动资产扫描，请手动输入合约地址。目前仅支持 Ethereum 主网、Sepolia 和 Holesky。`);
                return;
            }

            const tokens = await getAccountTokens(targetAddress, activeChainId);
            setDiscoveredTokens(tokens);
            if (tokens.length === 0) {
                setSuccessMessage(t('forward.noTokensFound') || "扫描完成，您的钱包中暂无 ERC20 代币。");
            } else {
                setSuccessMessage(t('forward.tokensFound', { n: tokens.length }) || `扫描成功！发现 ${tokens.length} 种代币，请在下方查看。`);
            }
        } catch (err) {
            console.error("Scanning failed", err);
            setSweepError(err.message || '扫描代币失败');
        } finally {
            setIsScanningTokens(false);
        }
    };
    // 网络切换时若有转出钱包私钥且曾扫描过，则重新扫描
    useEffect(() => {
        let pk = privateKey.trim();
        if (pk && !pk.startsWith('0x')) pk = '0x' + pk;
        if (pk && /^0x[0-9a-fA-F]{64}$/.test(pk) && (discoveredTokens.length > 0 || successMessage.includes('扫描'))) {
            handleScanTokens();
        }
    }, [activeChainId]);

    return (
        <div className="page-enter">
            {/* Full-screen loading overlay when sweeping */}
            {sweeping && createPortal(
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
                            <span>{t('forward.sweeping') || 'Sweeping...'}</span>
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

            <div className="alert alert-info" style={{ marginBottom: '24px' }}>
                <Shield size={18} />
                <span>{t('forward.infoAlert')}</span>
            </div>

            {/* Sweep ERC20 Card */}
            <div className="card" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className="card-header" style={{ background: 'var(--bg-glass)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Send size={20} style={{ color: 'var(--accent-purple)' }} />
                        {t('forward.sweepTokenLabel')}
                    </h3>
                </div>
                <div className="card-body">
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{t('forward.operationMode')}</span>
                        </label>
                        <input
                            className="form-input mono"
                            type="password"
                            placeholder={t('forward.privateKeyInputPlaceholder')}
                            value={privateKey}
                            onChange={(e) => setPrivateKey(e.target.value)}
                        />
                        <div className="alert alert-warning" style={{ marginTop: '10px', padding: '10px 14px', fontSize: '12px', lineHeight: '1.5' }}>
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span>{t('forward.pkRequiredHint') || '请输入转出钱包私钥（必填），代币将从该地址转出。'}</span>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="form-label">{t('auth.delegateContract') || '委托合约'}</label>
                        <input
                            className="form-input mono"
                            type="text"
                            list="auto-forward-deployed-contracts-list"
                            placeholder={t('auth.chooseDelegateContract') || '选择或输入合约地址 0x...（与转发授权时一致）'}
                            value={customContract || selectedContract}
                            onChange={(e) => {
                                const v = e.target.value;
                                setCustomContract(v);
                                setSelectedContract(v);
                            }}
                            style={{ fontSize: '13px' }}
                        />
                        <datalist id="auto-forward-deployed-contracts-list">
                            {deployedContracts.map((c) => (
                                <option key={c.address} value={c.address}>
                                    {c.name} — {truncateAddress(c.address)}
                                </option>
                            ))}
                        </datalist>
                        <div className="form-hint">{t('forward.delegateContractHint') || '请选择与【转发授权】中相同的委托合约地址，否则链上配置可能不一致。'}</div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {t('forward.sweepSponsorKeyLabel') || 'Gas 赞助商私钥（必填）'}
                        </label>
                        <input
                            className="form-input mono"
                            type="password"
                            placeholder={t('forward.sweepSponsorKeyPlaceholder') || '0x... 由赞助商钱包代付 Gas'}
                            value={sweepSponsorKey}
                            onChange={(e) => setSweepSponsorKey(e.target.value)}
                            style={{ fontSize: '13px' }}
                        />
                        <div className="form-hint">{t('forward.sweepSponsorKeyHint') || '由赞助商钱包支付 Gas，操作账户无需 ETH 即可完成搬运。'}</div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {t('forward.sweepRecipientLabel') || '代币接收地址（必填）'}
                        </label>
                        <input
                            className="form-input mono"
                            type="text"
                            placeholder={t('forward.sweepRecipientPlaceholder') || '0x...（必填，代币将转入此地址）'}
                            value={sweepRecipient}
                            onChange={(e) => setSweepRecipient(e.target.value)}
                            style={{ fontSize: '13px' }}
                        />
                        <div className="form-hint">{t('forward.sweepRecipientHint') || '代币将转入此地址，请仔细核对。'}</div>
                    </div>

                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                        {t('forward.step4Desc')} <br />
                        {t('forward.sweepNotice')}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 600 }}>{t('forward.scanAndSweepTitle') || '扫描并搬运已知代币'}</h4>
                        <button className="btn btn-secondary" onClick={handleScanTokens} disabled={isScanningTokens || !privateKey.trim()} style={{ padding: '8px 16px', fontSize: '13px' }}>
                            {isScanningTokens ? <><Loader2 size={14} className="spin" /> {t('forward.scanning') || '扫描中...'}</> : <><Search size={14} /> {t('forward.scanAssetsBtn') || '扫描钱包资产'}</>}
                        </button>
                    </div>

                    {discoveredTokens.length > 0 && (
                        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {discoveredTokens.map((token, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-glass)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {token.thumbnailUrl ? <img src={token.thumbnailUrl} alt={token.tokenSymbol} width={24} height={24} style={{ borderRadius: '50%' }} /> : <Coins size={24} style={{ color: 'var(--accent-blue)' }} />}
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{token.tokenName} ({token.tokenSymbol})</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>余额: {parseFloat(token.balance).toFixed(4)}</div>
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => { handleSweepToken(token.contractAddress); }}
                                        disabled={!privateKey.trim() || !sweepSponsorKey.trim() || !sweepRecipient.trim() || isSweeping === token.contractAddress || (isSweeping !== false && isSweeping !== token.contractAddress)}
                                        style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}
                                    >
                                        {isSweeping === token.contractAddress ? <Loader2 size={14} className="spin" /> : t('forward.sweepBtn')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {sweepError && isSweeping === false && (
                        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                            <XCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span style={{ wordBreak: 'break-all', fontSize: '13px', lineHeight: '1.4' }}>{sweepError}</span>
                        </div>
                    )}

                    <hr className="divider" style={{ margin: '24px 0', borderColor: 'var(--border-subtle)' }} />

                    <div className="form-group">
                        <label className="form-label">{t('forward.manualSweepLabel') || '手动输入合约地址搬运'}</label>
                        <input
                            className="form-input mono"
                            type="text"
                            placeholder={t('forward.tokenAddressPlaceholder')}
                            value={tokenAddress}
                            onChange={(e) => setTokenAddress(e.target.value)}
                        />
                        <div className="form-hint">{t('forward.sweepHint')}</div>
                    </div>

                    <button
                        className="btn btn-primary btn-full"
                        onClick={() => handleSweepToken()}
                        disabled={!!isSweeping || !tokenAddress || !sweepRecipient.trim() || !sweepSponsorKey.trim() || !privateKey.trim()}
                        style={{ background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}
                    >
                        {isSweeping && isSweeping === tokenAddress ? (
                            <><Loader2 size={18} className="spin" /> {t('forward.forwarding')}</>
                        ) : (
                            <><Send size={18} /> 立即转移代币 (Sweep)</>
                        )}
                    </button>
                </div>
            </div>

        </div>
    );
}
