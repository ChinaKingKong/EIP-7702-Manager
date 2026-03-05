import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Send, Zap, Settings, RefreshCw, AlertTriangle, CheckCircle, XCircle, Loader2, Search, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPublicClient, getWalletClient } from '../services/eip7702';
import { getDeployedContracts } from '../services/deployedContracts';
import { getAccountTokens } from '../services/ankrIndex';
import { getActiveAuthorizations } from '../services/authorizationCache';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';
import { truncateAddress } from '../services/wallet';
import { createWalletClient, custom, http, encodeFunctionData, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia, holesky } from 'viem/chains';
import { RPC_URLS } from '../config';

const CHAIN_MAP = { 1: mainnet, 11155111: sepolia, 17000: holesky };

export default function AutoForward() {
    const { isConnected, address: connectedAddress, chainId, disconnectedChainId } = useWallet();
    const { t } = useI18n();
    const activeChainId = isConnected ? chainId : disconnectedChainId;

    // 状态管理
    const [deployedContracts, setDeployedContracts] = useState([]);
    const [selectedContract, setSelectedContract] = useState('');
    const [privateKey, setPrivateKey] = useState('');
    const [sweepSponsorKey, setSweepSponsorKey] = useState('');
    const [sweepRecipient, setSweepRecipient] = useState('');

    // 配置表单状态
    const [forwardTarget, setForwardTarget] = useState('');
    const [gasSponsor, setGasSponsor] = useState('');
    const [autoForwardEnabled, setAutoForwardEnabled] = useState(true);

    // ERC20 Sweep 状态
    const [tokenAddress, setTokenAddress] = useState('');
    const [discoveredTokens, setDiscoveredTokens] = useState([]);
    const [isScanningTokens, setIsScanningTokens] = useState(false);

    // 当前链上状态
    const [onchainConfig, setOnchainConfig] = useState(null);
    const [isLoadingConfig, setIsLoadingConfig] = useState(false);

    // 交互状态
    const [isUpdating, setIsUpdating] = useState(false);
    const [isSweeping, setIsSweeping] = useState(false);
    const [configError, setConfigError] = useState('');
    const [sweepError, setSweepError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [sweeping, setSweeping] = useState(false); // Global full-screen loading state

    // 组件挂载时获取已部署的合约
    useEffect(() => {
        const contracts = getDeployedContracts();
        setDeployedContracts(contracts);
        if (contracts.length > 0) {
            setSelectedContract(contracts[0].address);
        }
    }, []);

    // Load config helper
    const loadConfig = async (userAddress, rpcUrl = null) => {
        try {
            setIsLoadingConfig(true);
            setConfigError('');

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

            // Populate form if initialized
            if (result[3]) {
                setForwardTarget(result[0]);
                setGasSponsor(result[1] === '0x0000000000000000000000000000000000000000' ? '' : result[1]);
                setAutoForwardEnabled(result[2]);
            }
        } catch (err) {
            console.error("加载配置失败:", err);
            setOnchainConfig(null);
        } finally {
            setIsLoadingConfig(false);
        }
    };

    // 当私钥输入导致账户变更时，尝试加载配置
    useEffect(() => {
        // Simple heuristic for valid PK
        let pk = privateKey.trim();
        if (pk && !pk.startsWith('0x')) pk = '0x' + pk;

        if (pk && /^0x[0-9a-fA-F]{64}$/.test(pk)) {
            try {
                const account = privateKeyToAccount(pk);
                // using configured RPC from .env
                loadConfig(account.address, RPC_URLS[chainId] || RPC_URLS[11155111]);
            } catch (e) {
                // ignore invalid pk parsing
            }
        } else if (isConnected && connectedAddress) {
            loadConfig(connectedAddress);
        }
    }, [privateKey, connectedAddress, isConnected]);


    // 操作：处理 ETH 自动转发配置更新
    const handleUpdateConfig = async () => {
        setConfigError('');
        setSuccessMessage('');
        setIsUpdating(true);

        try {
            let pk = privateKey.trim();
            if (pk && !pk.startsWith('0x')) pk = '0x' + pk;

            let walletClient, accountAddress, accountObj, publicClient;

            if (pk && /^0x[0-9a-fA-F]{64}$/.test(pk)) {
                // Private key mode
                const account = privateKeyToAccount(pk);
                accountObj = account;
                accountAddress = account.address;
                const rpcUrl = RPC_URLS[chainId] || RPC_URLS[11155111];
                const chain = CHAIN_MAP[chainId] || sepolia;
                walletClient = createWalletClient({
                    account,
                    chain,
                    transport: http(rpcUrl),
                });
                publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
            } else if (isConnected) {
                // Browser wallet mode
                walletClient = getWalletClient(chainId);
                const accounts = await walletClient.getAddresses();
                accountObj = accounts[0]; // string address for JSON-RPC wallet
                accountAddress = accounts[0];
                publicClient = getPublicClient(chainId);
            } else {
                throw new Error("请连接钱包或输入 EOA 私钥！");
            }

            if (!forwardTarget || !/^0x[a-fA-F0-9]{40}$/.test(forwardTarget)) {
                throw new Error("无效的转发目标地址");
            }

            const FORWARDER_ABI = [{
                name: 'updateConfig', type: 'function', stateMutability: 'nonpayable',
                inputs: [
                    { name: '_forwardTarget', type: 'address' },
                    { name: '_gasSponsor', type: 'address' },
                    { name: '_autoForward', type: 'bool' },
                ],
                outputs: [],
            }];

            const sponsorAddress = gasSponsor && /^0x[a-fA-F0-9]{40}$/.test(gasSponsor)
                ? gasSponsor
                : '0x0000000000000000000000000000000000000000';

            const txParams = {
                account: accountObj,
                to: accountAddress,
                data: encodeFunctionData({
                    abi: FORWARDER_ABI,
                    functionName: 'updateConfig',
                    args: [forwardTarget, sponsorAddress, autoForwardEnabled],
                }),
                value: 0n
            };

            // In private key mode, sign a fresh authorization so the tx is type 0x04
            if (pk && /^0x[0-9a-fA-F]{64}$/.test(pk)) {
                const activeAuth = getActiveAuthorizations().find(a => a.walletAddress?.toLowerCase() === accountAddress.toLowerCase());
                if (activeAuth?.delegateContract) {
                    const authorization = await walletClient.signAuthorization({
                        contractAddress: activeAuth.delegateContract,
                        executor: 'self',
                    });
                    txParams.authorizationList = [authorization];
                }
            }

            const hash = await walletClient.sendTransaction(txParams);

            await publicClient.waitForTransactionReceipt({ hash });

            setSuccessMessage(t('forward.targetUpdated'));
            loadConfig(accountAddress, pk ? (RPC_URLS[chainId] || RPC_URLS[11155111]) : null);

        } catch (err) {
            console.error(err);
            const msg = err.message || '';
            if (msg.includes('External transactions to internal accounts cannot include data')) {
                setConfigError('节点拒绝了交易：当前账户尚未完成 EIP-7702 委托授权。请先前往左侧【转发授权】页面签署并执行初始委托，或者更换 RPC 节点重试。');
            } else {
                setConfigError(msg || '更新配置失败');
            }
        } finally {
            setIsUpdating(false);
        }
    };

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

            let pk = privateKey.trim();
            if (pk && !pk.startsWith('0x')) pk = '0x' + pk;

            let walletClient, accountAddress, accountObj, publicClient;

            if (pk && /^0x[0-9a-fA-F]{64}$/.test(pk)) {
                const account = privateKeyToAccount(pk);
                accountObj = account;
                accountAddress = account.address;
                const rpcUrl = RPC_URLS[activeChainId] || RPC_URLS[11155111];
                const chain = CHAIN_MAP[activeChainId] || sepolia;
                walletClient = createWalletClient({
                    account,
                    chain,
                    transport: http(rpcUrl),
                });
                publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
            } else if (isConnected) {
                walletClient = getWalletClient(chainId);
                const accounts = await walletClient.getAddresses();
                accountObj = accounts[0];
                accountAddress = accounts[0];
                publicClient = getPublicClient(chainId);
            } else {
                throw new Error("请连接钱包或输入 EOA 私钥！");
            }

            // 可选：使用赞助商私钥，通过 EIP-7702 原生机制代扣 Gas
            let sponsorClient = null;
            let sponsorAddress = null;

            if (sweepSponsorKey && sweepSponsorKey.trim()) {
                let formattedSponsorKey = sweepSponsorKey.trim();
                if (!formattedSponsorKey.startsWith('0x')) formattedSponsorKey = `0x${formattedSponsorKey}`;
                if (!/^0x[0-9a-fA-F]{64}$/.test(formattedSponsorKey)) {
                    throw new Error("赞助商私钥格式无效。");
                }
                const sponsorAccount = privateKeyToAccount(formattedSponsorKey);
                const rpcUrl = RPC_URLS[activeChainId] || RPC_URLS[11155111];
                const chain = CHAIN_MAP[activeChainId] || sepolia;
                sponsorClient = createWalletClient({
                    account: sponsorAccount,
                    chain,
                    transport: http(rpcUrl),
                });
                sponsorAddress = sponsorAccount.address;

                // 检查赞助商余额是否足够
                const sponsorBalance = await publicClient.getBalance({ address: sponsorAddress });
                if (sponsorBalance === 0n) {
                    throw new Error('赞助商钱包没有 ETH。请充值 ETH Gas。');
                }
            }

            // 自费模式：交易由“操作方式”账户直接发出
            // 赞助模式：交易从赞助商钱包发出，但在 ERC20 事件里，代币的 from 仍然是被委托的 EOA

            // Determine the logic path
            const isSponsored = !!(sweepSponsorKey && sweepSponsorKey.trim());
            const isCustomRecipient = sweepRecipient.trim().length > 0;
            const finalRecipient = isCustomRecipient ? sweepRecipient.trim() : (onchainConfig?.forwardTarget || '');

            // 赞助模式：合约 onlySelfOrSponsor 要求 msg.sender == gasSponsor，否则会 revert，代币不会转
            if (isSponsored) {
                if (!onchainConfig?.initialized) {
                    throw new Error('操作账户尚未初始化转发配置。请先在【转发授权】完成委托并初始化，且将 Gas 代付人 设为当前赞助商地址。');
                }
                const configSponsor = (onchainConfig.gasSponsor || '').toLowerCase();
                const sponsor = (sponsorAddress || '').toLowerCase();
                if (configSponsor !== sponsor) {
                    throw new Error(
                        `链上 Gas 代付人 (${truncateAddress(onchainConfig.gasSponsor)}) 与当前赞助商地址不一致，合约会拒绝调用。请在【转发配置】中把 Gas 代付人 设为当前赞助商地址并点击更新配置。`
                    );
                }
            }

            // 使用默认接收地址时必须有转发目标
            if (!isCustomRecipient && (!finalRecipient || finalRecipient === '0x0000000000000000000000000000000000000000')) {
                throw new Error('请填写搬运接收地址，或在【转发配置】中设置转发目标地址后再搬运。');
            }

            // 1. Log the intent for clarity
            console.log(
                `[Token Sweep] Payer: ${sponsorAddress || accountAddress}, Source account: ${accountAddress}, Token destination: ${finalRecipient || 'Default Forward Target'}`
            );

            let txParams;
            if (!isSponsored && isCustomRecipient) {
                // Scenario A: Self-paid + Custom Recipient
                // Use standard ERC20 transfer for a more "intuitive" explorer view (From: User -> To: Token)
                const ERC20_ABI = [{
                    name: 'transfer', type: 'function', stateMutability: 'nonpayable',
                    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
                    outputs: [{ name: '', type: 'bool' }],
                }, {
                    name: 'balanceOf', type: 'function', stateMutability: 'view',
                    inputs: [{ name: 'account', type: 'address' }],
                    outputs: [{ name: '', type: 'uint256' }],
                }];

                const tokenBalance = await publicClient.readContract({
                    address: sweepAddr,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [accountAddress],
                });

                if (tokenBalance === 0n) throw new Error("该代币余额为 0，无需搬运。");

                txParams = {
                    account: accountObj,
                    to: sweepAddr, // Call Token Contract directly
                    data: encodeFunctionData({
                        abi: ERC20_ABI,
                        functionName: 'transfer',
                        args: [finalRecipient, tokenBalance],
                    }),
                    value: 0n
                };
            } else {
                // Scenario B: Sponsored OR Default Recipient (via EIP-7702)
                // MUST hit the EOA to trigger EIP-7702 smart contract logic
                const SWEEP_ABI = [{
                    name: 'sweepToken', type: 'function', stateMutability: 'nonpayable',
                    inputs: [{ name: 'token', type: 'address' }],
                    outputs: [],
                }, {
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

                const functionName = isCustomRecipient ? 'sweepTokenTo' : 'sweepToken';
                const args = isCustomRecipient ? [sweepAddr, finalRecipient] : [sweepAddr];

                if (isSponsored) {
                    if (!sponsorClient || !sponsorAddress) {
                        throw new Error('赞助商钱包未正确初始化，请检查赞助商私钥。');
                    }

                    // 赞助模式：由赞助商发起 type 0x04 交易，调用被委托 EOA 上的合约
                    txParams = {
                        to: accountAddress,
                        data: encodeFunctionData({
                            abi: SWEEP_ABI,
                            functionName,
                            args,
                        }),
                        value: 0n,
                    };

                    toast.loading(
                        `正在由赞助商代付 Gas，搬运地址为 ${truncateAddress(accountAddress)} -> ${finalRecipient || '默认设置'}`,
                        { duration: 3000 }
                    );
                } else {
                    // 自费模式：由“操作方式”账户直接调用被委托 EOA
                    txParams = {
                        account: accountObj,
                        to: accountAddress,
                        data: encodeFunctionData({
                            abi: SWEEP_ABI,
                            functionName,
                            args,
                        }),
                        value: 0n,
                    };
                }
            }

            const txClient = isSponsored && sponsorClient ? sponsorClient : walletClient;
            const hash = await txClient.sendTransaction(txParams);

            setSweeping(true); // Start full-screen loading overlay

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') {
                throw new Error(
                    '交易已上链但执行失败（revert）。常见原因：链上 Gas 代付人 与当前赞助商地址不一致、操作账户该代币余额为 0、或接收地址无效。请检查【转发配置】中的 Gas 代付人 并重试。'
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
            let targetAddress = connectedAddress;
            if (pk && /^0x[0-9a-fA-F]{64}$/.test(pk)) {
                targetAddress = privateKeyToAccount(pk).address;
            }
            if (!targetAddress) throw new Error("无法确定要扫描的 EOA 地址，请连接钱包或输入私钥");

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
    // Auto-scan tokens when network changes if user has already scanned before
    useEffect(() => {
        if (isConnected && (discoveredTokens.length > 0 || successMessage.includes('扫描'))) {
            handleScanTokens();
        }
    }, [chainId]);

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
                            <span>{t('forward.pkRequiredHint') || '搬运代币需要输入 EOA 私钥。MetaMask 等浏览器钱包暂不支持 EIP-7702 签名，仅连接钱包无法完成搬运操作。'}</span>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {t('auth.sponsorKeyLabel') || 'Gas 赞助商私钥（可选）'}
                        </label>
                        <input
                            className="form-input mono"
                            type="password"
                            placeholder={t('auth.sponsorKeyPlaceholder') || '留空则由 EOA 自己支付 Gas'}
                            value={sweepSponsorKey}
                            onChange={(e) => setSweepSponsorKey(e.target.value)}
                            style={{ fontSize: '13px' }}
                        />
                        <div className="form-hint">{t('auth.sponsorKeyHint') || '填写后由赞助商钱包支付 Gas，EOA 无需 ETH 即可完成搬运'}</div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {t('forward.sweepRecipientLabel') || '搬运接收地址 (可选)'}
                        </label>
                        <input
                            className="form-input mono"
                            type="text"
                            placeholder={t('forward.sweepRecipientPlaceholder') || '0x... (可选，若不填则默认发往当前设置的转发目标)'}
                            value={sweepRecipient}
                            onChange={(e) => setSweepRecipient(e.target.value)}
                            style={{ fontSize: '13px' }}
                        />
                        <div className="form-hint">{t('forward.sweepRecipientHint') || '指定一个代币接收地址，若留空则尝试转发到上方的【转发目标地址】。'}</div>
                    </div>

                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                        {t('forward.step4Desc')} <br />
                        {t('forward.sweepNotice')}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 600 }}>{t('forward.scanAndSweepTitle') || '扫描并搬运已知代币'}</h4>
                        <button className="btn btn-secondary" onClick={handleScanTokens} disabled={isScanningTokens} style={{ padding: '8px 16px', fontSize: '13px' }}>
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
                                        disabled={isSweeping === token.contractAddress || isSweeping !== false && isSweeping !== token.contractAddress}
                                        style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}
                                    >
                                        {isSweeping === token.contractAddress ? <Loader2 size={14} className="spin" /> : t('forward.sweepBtn')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {sweepError && !isUpdating && isSweeping === false && (
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
                        disabled={!!isSweeping || !tokenAddress}
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
