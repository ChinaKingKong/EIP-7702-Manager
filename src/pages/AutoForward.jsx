import React, { useState, useEffect } from 'react';
import { Shield, Send, Zap, Settings, RefreshCw, AlertTriangle, CheckCircle, XCircle, Loader2, Search, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPublicClient, getWalletClient, EIP7702_AUTO_FORWARDER_ABI } from '../services/eip7702';
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
    const { isConnected, address: connectedAddress, chainId } = useWallet();
    const { t } = useI18n();

    // 状态管理
    const [deployedContracts, setDeployedContracts] = useState([]);
    const [selectedContract, setSelectedContract] = useState('');
    const [privateKey, setPrivateKey] = useState('');

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
        setIsSweeping(sweepAddr); // Store the address to indicate which token is sweeping

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
                const rpcUrl = RPC_URLS[chainId] || RPC_URLS[11155111];
                const chain = CHAIN_MAP[chainId] || sepolia;
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

            const SWEEP_ABI = [{
                name: 'sweepToken', type: 'function', stateMutability: 'nonpayable',
                inputs: [{ name: 'token', type: 'address' }],
                outputs: [],
            }];

            const txParams = {
                account: accountObj,
                to: accountAddress,
                data: encodeFunctionData({
                    abi: SWEEP_ABI,
                    functionName: 'sweepToken',
                    args: [sweepAddr],
                }),
                value: 0n
            };

            // In private key mode, sign a fresh authorization so the tx is type 0x04
            if (pk && /^0x[0-9a-fA-F]{64}$/.test(pk)) {
                const activeAuth = getActiveAuthorizations().find(a => a.walletAddress?.toLowerCase() === accountAddress.toLowerCase());
                let delegateAddr = activeAuth?.delegateContract;
                // Fallback: use the first deployed contract if no cached auth
                if (!delegateAddr && deployedContracts.length > 0) {
                    delegateAddr = deployedContracts[0].address;
                }
                if (delegateAddr) {
                    const authorization = await walletClient.signAuthorization({
                        contractAddress: delegateAddr,
                        executor: 'self',
                    });
                    txParams.authorizationList = [authorization];
                }
            }

            const hash = await walletClient.sendTransaction(txParams);

            await publicClient.waitForTransactionReceipt({ hash });
            setSuccessMessage(t('forward.tokenSwept'));

        } catch (err) {
            console.error(err);
            const msg = err.message || '';
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
            if (!supportedChains.includes(chainId)) {
                setSweepError(`当前网络 (Chain ID: ${chainId}) 暂时不支持自动资产扫描，请手动输入合约地址。目前仅支持 Ethereum 主网、Sepolia 和 Holesky。`);
                return;
            }

            const tokens = await getAccountTokens(targetAddress, chainId);
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
        <div>
            <div className="alert alert-info" style={{ marginBottom: '24px' }}>
                <Shield size={18} />
                <span>{t('forward.infoAlert')}</span>
            </div>

            {/* Sweep ERC20 Card */}
            <div className="card" style={{ border: '1px solid var(--accent-purple)' }}>
                <div className="card-header" style={{ background: 'rgba(124, 58, 237, 0.05)' }}>
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
                        <div className="alert alert-error" style={{ marginTop: '10px', padding: '10px 14px', fontSize: '12px', lineHeight: '1.5' }}>
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span>{t('forward.pkRequiredHint') || '搬运代币需要输入 EOA 私钥。MetaMask 等浏览器钱包暂不支持 EIP-7702 签名，仅连接钱包无法完成搬运操作。'}</span>
                        </div>
                    </div>

                    <hr className="divider" style={{ margin: '0 0 20px 0' }} />

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
