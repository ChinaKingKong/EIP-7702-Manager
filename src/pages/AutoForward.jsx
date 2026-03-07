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
import { saveAuthorization } from '../services/authorizationCache';
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
        const contracts = getDeployedContracts().filter(c => Number(c.chainId) === Number(activeChainId));
        setDeployedContracts(contracts);
        if (contracts.length > 0) {
            setSelectedContract((prev) => prev || contracts[0].address);
        } else {
            setSelectedContract('');
        }
    }, [activeChainId]);

    // Load config helper
    const loadConfig = async (userAddress, rpcUrl = null) => {
        try {
            setIsLoadingConfig(true);

            let publicClient;
            if (rpcUrl) {
                publicClient = createPublicClient({ chain: CHAIN_MAP[activeChainId] || sepolia, transport: http(rpcUrl) });
            } else {
                publicClient = getPublicClient(activeChainId);
            }

            // Define ABIs by expected number of return values
            const ABI_VERSIONS = [
                {
                    version: 'v2',
                    outputs: 5,
                    abi: [{ name: 'getConfig', type: 'function', stateMutability: 'view', inputs: [], outputs: [
                        { name: '_forwardTarget', type: 'address' }, { name: '_gasSponsor', type: 'address' },
                        { name: '_autoForwardEnabled', type: 'bool' }, { name: '_initialized', type: 'bool' },
                        { name: '_emergencyRescue', type: 'address' }
                    ]}]
                },
                {
                    version: 'v1',
                    outputs: 4,
                    abi: [{ name: 'getConfig', type: 'function', stateMutability: 'view', inputs: [], outputs: [
                        { name: '_forwardTarget', type: 'address' }, { name: '_gasSponsor', type: 'address' },
                        { name: '_autoForwardEnabled', type: 'bool' }, { name: '_initialized', type: 'bool' }
                    ]}]
                },
                {
                    version: 'v0',
                    outputs: 3,
                    abi: [{ name: 'getConfig', type: 'function', stateMutability: 'view', inputs: [], outputs: [
                        { name: '_forwardTarget', type: 'address' }, { name: '_gasSponsor', type: 'address' },
                        { name: '_autoForwardEnabled', type: 'bool' }
                    ]}]
                }
            ];

            let result = null;
            let detectedVersion = null;

            for (const ver of ABI_VERSIONS) {
                try {
                    result = await publicClient.readContract({
                        address: userAddress,
                        abi: ver.abi,
                        functionName: 'getConfig',
                    });
                    detectedVersion = ver.version;
                    break; // Success
                } catch (e) {
                    // Continue to next fallback
                }
            }

            if (detectedVersion && result) {
                console.log(`[Config] Successfully loaded ${detectedVersion} configuration`);
                setOnchainConfig({
                    forwardTarget: result[0],
                    gasSponsor: result[1],
                    autoForwardEnabled: result[2],
                    initialized: detectedVersion === 'v0' ? true : result[3],
                    emergencyRescue: detectedVersion === 'v2' ? result[4] : '0x0000000000000000000000000000000000000000',
                });
            } else {
                // If all ABIs fail, try to at least check if there is code
                const code = await publicClient.getCode({ address: userAddress });
                if (code && code !== '0x' && code.length > 20) {
                    console.log("[Config] Contract code found but getConfig failed. Likely an incompatible implementation.");
                }
                setOnchainConfig(null);
            }
        } catch (err) {
            console.error("加载配置最终失败:", err);
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
            // 调试：确认实际使用的 RPC（改 .env 后需重新 npm run build 才会生效）
            const rpcDisplay = rpcUrl ? rpcUrl.replace(/\/v3\/[a-f0-9]+/i, '/v3/***').replace(/\/[a-f0-9]{64}$/i, '/***') : 'default';
            console.log('[Token Sweep] 当前链', activeChainId, 'RPC:', rpcDisplay);
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

            // Robust multi-ABI getConfig reading
            const ABI_VERSIONS = [
                { version: 'v2', abi: [{ name: 'getConfig', type: 'function', stateMutability: 'view', inputs: [], outputs: [
                    { name: '_forwardTarget', type: 'address' }, { name: '_gasSponsor', type: 'address' },
                    { name: '_autoForwardEnabled', type: 'bool' }, { name: '_initialized', type: 'bool' },
                    { name: '_emergencyRescue', type: 'address' }
                ]}] },
                { version: 'v1', abi: [{ name: 'getConfig', type: 'function', stateMutability: 'view', inputs: [], outputs: [
                    { name: '_forwardTarget', type: 'address' }, { name: '_gasSponsor', type: 'address' },
                    { name: '_autoForwardEnabled', type: 'bool' }, { name: '_initialized', type: 'bool' }
                ]}] },
                { version: 'v0', abi: [{ name: 'getConfig', type: 'function', stateMutability: 'view', inputs: [], outputs: [
                    { name: '_forwardTarget', type: 'address' }, { name: '_gasSponsor', type: 'address' },
                    { name: '_autoForwardEnabled', type: 'bool' }
                ]}] }
            ];

            let configInitialized = false;
            let configGasSponsor = '';
            let detectedVer = null;

            for (const ver of ABI_VERSIONS) {
                try {
                    const res = await publicClient.readContract({
                        address: accountAddress,
                        abi: ver.abi,
                        functionName: 'getConfig',
                    });
                    detectedVer = ver.version;
                    configInitialized = ver.version === 'v0' ? true : res[3];
                    configGasSponsor = (res[1] || '').toLowerCase();
                    console.log(`[Token Sweep] Detected ${ver.version} config on-chain.`);
                    break;
                } catch (e) {
                    // continue
                }
            }

            // Fallback to getCode if all reading failed
            if (!detectedVer) {
                try {
                    const code = await publicClient.getCode({ address: accountAddress });
                    if (code && code !== '0x' && code.length > 20) {
                        console.warn('[Token Sweep] getConfig failed, but code exists. Assuming initialized with current sponsor.');
                        configInitialized = true;
                        configGasSponsor = (sponsorAddress || '').toLowerCase();
                    }
                } catch (_) { }
            }

            if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
                throw new Error('请选择或输入与【转发授权】一致的委托合约地址。');
            }
            if (!configInitialized) {
                console.warn('[Token Sweep] 未检测到已初始化的委托配置。由于合约安全限制，未初始化的账户无法由赞助商代付搬运。');
                const proceed = window.confirm("检测到您的账户尚未完成【转发授权】初始化。赞助商代付搬运需要先在链上设置 Gas 赞助商。是否仍尝试强制执行？(建议先前往【转发授权】页面完成授权)");
                if (!proceed) {
                    setIsSweeping(false);
                    return;
                }
            } else {
                const sponsor = (sponsorAddress || '').toLowerCase();
                if (configGasSponsor !== sponsor && configGasSponsor !== '0x0000000000000000000000000000000000000000') {
                    console.warn(`[Token Sweep] 链上 Gas 代付人(${configGasSponsor})与当前赞助商(${sponsor})不一致。`);
                    const proceed = window.confirm(`链上设置的 Gas 代付人与您当前填写的赞助商私钥不符。交易可能失败。是否继续？`);
                    if (!proceed) {
                        setIsSweeping(false);
                        return;
                    }
                }
            }

            // 交易层：赞助商 → 操作账户（赞助商付 Gas，调用操作账户的委托合约）
            // 代币层：操作账户(转出方) → 代币接收地址(接收方)，由合约 sweepTokenTo 执行
            console.log(
                `[Token Sweep] 交易: 赞助商 ${sponsorAddress} → 操作账户 ${accountAddress} | 代币转出方: ${accountAddress}, 代币接收方: ${finalRecipient}`
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

            // 使用 type 0x04（带 authorizationList）强制链上执行委托代码，解决主网“普通 tx 不跑委托”的问题
            const userWalletClient = createWalletClient({
                account,
                chain,
                transport: http(rpcUrl),
            });

            // 关键修复：显式获取操作账户的最新 Nonce
            const currentNonce = await publicClient.getTransactionCount({
                address: accountAddress
            });
            console.log(`[Token Sweep] 操作账户 ${accountAddress} 当前 Nonce: ${currentNonce}`);

            // 验证并显示委托合约信息
            const implementationCode = await publicClient.getCode({ address: contractAddress });
            console.log(`[Token Sweep] 委托实现合约: ${contractAddress}`);
            console.log(`[Token Sweep] 合约代码长度: ${implementationCode?.length || 0}`);
            if (!implementationCode || implementationCode === '0x') {
                console.warn('[Token Sweep] 警告：委托实现合约在当前链上没有检测到代码！搬运将无效。');
            }

            const authorization = await userWalletClient.signAuthorization({
                account,
                contractAddress,
                chainId: activeChainId,
                nonce: currentNonce, // 使用最新 Nonce 确保委托生效
            });

            // 增强型日志：显示完整字段并确保字段兼容性
            const finalAuth = {
                ...authorization,
                contractAddress: authorization.contractAddress || authorization.address,
                address: authorization.address || authorization.contractAddress,
            };

            console.log('[Token Sweep] 签署的 Authorization 对象:', {
                ...finalAuth,
                nonce: finalAuth.nonce.toString(),
                chainId: finalAuth.chainId.toString(),
            });

            const callData = encodeFunctionData({
                abi: SWEEP_ABI,
                functionName: 'sweepTokenTo',
                args: [sweepAddr, finalRecipient],
            });
            console.log('[Token Sweep] 编码后的 Data:', callData);
            console.log(`[Token Sweep] 目标地址: ${accountAddress}`);

            // Start full-screen loading overlay before sending transaction
            setSweeping(true);

            let hash;
            // 检查 EOA 账户是否已经具有委托代码，且委托地址符合预期
            const eoaCode = await publicClient.getCode({ address: accountAddress });
            // EIP-7702 代码格式: 0xef0100 + 20字节地址
            const delegatedTo = (eoaCode && eoaCode.startsWith('0xef0100')) 
                ? '0x' + eoaCode.slice(8).toLowerCase() 
                : null;
            const isCorrectDelegation = delegatedTo && delegatedTo === contractAddress.toLowerCase();
            const isDelegated = !!(eoaCode && eoaCode !== '0x' && eoaCode.length > 20);

            if (isCorrectDelegation) {
                console.log('[Token Sweep] 检测到账号已存有效委托，将尝试直接调用而不带 authorizationList。');
                try {
                    hash = await sponsorClient.sendTransaction({
                        to: accountAddress,
                        data: callData,
                        value: 0n
                    });
                } catch (e) {
                    console.warn('[Token Sweep] 直接调用失败，回退到带 authorizationList 的方式:', e);
                    hash = await sponsorClient.sendTransaction({
                        authorizationList: [finalAuth],
                        to: accountAddress,
                        data: callData,
                        value: 0n
                    });
                }
            } else {
                console.log('[Token Sweep] 账号未检测到有效委托，将使用 authorizationList。');
                hash = await sponsorClient.sendTransaction({
                    authorizationList: [finalAuth],
                    to: accountAddress,
                    data: callData,
                    value: 0n
                });
            }

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            console.log('[Token Sweep] 交易回执成功:', receipt);
            console.log('[Token Sweep] 回执日志 (Logs):', receipt.logs);

            if (receipt.status !== 'success') {
                const revertReason = receipt.revertReason || '';
                if (revertReason.includes('\\K') || revertReason === 'K') {
                    throw new Error('检测到该代币可能是虚假/欺诈代币（Vanity Honeypot）。此类代币通常在 transfer 时会故意报错 (\\K) 以阻止用户提取。建议忽略此类资产。');
                }
                throw new Error(
                    '交易已上链但执行失败（revert）。常见原因：链上 Gas 代付人与当前赞助商地址不一致、操作账户该代币余额为 0、或接收地址无效。请在【转发授权】初始化时将 Gas 代付人 设为当前赞助商地址后重试。'
                );
            }

            // Check if TokenSwept event exists in logs
            // V2 Signature: TokenSwept(address indexed token, address indexed to, uint256 amount)
            const tokenSweptTopic = '0x115d7b5114b5954762cc233b141a7c777a8f79d93f50af7216d645c87fb4883e'; 
            const sweepLog = receipt.logs.find(l => l.topics[0] === tokenSweptTopic);
            if (!sweepLog) {
                console.warn('[Token Sweep] 未检测到 TokenSwept 事件！可能执行了 fallback 或其他逻辑，或者余额为 0 被跳过。');
                throw new Error('授权交易已成功发送，但代币未发生转移。请检查:\n1) 委托合约是否包含最新 sweepToken(s)To 逻辑\n2) 被盗账户的 ERC20 余额是否 > 0\n3) 是否此代币不支持标准 transfer (如旧版 USDT)。');
            } else {
                console.log('[Token Sweep] 检测到 TokenSwept 事件，合约内部执行成功。');
            }

            toast.success(t('forward.sweepSuccess') || 'Tokens swept successfully!');

            // Save to local authorization cache (History)
            saveAuthorization({
                id: `sweep-${Date.now()}`,
                walletAddress: accountAddress,
                delegateContract: contractAddress,
                contractName: deployedContracts.find(c => c.address.toLowerCase() === contractAddress.toLowerCase())?.name || 'AutoForwarder',
                chainId: Number(activeChainId || 11155111),
                status: 'completed',
                timestamp: Date.now(),
                txHash: hash,
                type: 'sweep',
                tokenAddress: sweepAddr,
                recipient: finalRecipient
            });

            try {
                const tx = await publicClient.getTransaction({ hash });
                const txType = tx && 'type' in tx ? (tx.type === 'eip7702' ? '0x04 (EIP-7702)' : tx.type) : 'unknown';
                console.log(`[Token Sweep] 交易成功 hash=${receipt.transactionHash}，上链类型=${txType}，代币应从 ${accountAddress} 转至 ${finalRecipient}。若区块浏览器无 Internal Txns，主网执行层可能仍未完整支持，建议在 Sepolia/Holesky 测试网验证。`);
            } catch (_) {
                console.log(`[Token Sweep] 交易成功 hash=${receipt.transactionHash}，代币应从 ${accountAddress} 转至 ${finalRecipient}，请在区块浏览器查看该笔交易的 ERC20 Transfer 事件确认。`);
            }

            // Auto-refresh token list after sweep
            setTimeout(() => {
                handleScanTokens();
            }, 1000);

        } catch (err) {
            console.error(err);
            const msg = err.shortMessage || err.message || 'Sweep failed';
            let displayMsg;
            
            if (msg.includes('\\K') || msg === 'K' || msg.includes('Execution reverted: \\K')) {
                displayMsg = '搬运已撤回：检测到该代币 (VanityTrx.org 等) 可能是恶意 Honeypot 代币。此类代币通过特殊的合约代码阻止 transfer 操作。除非您是合约发布者，否则无法搬运此代币。';
            } else if (msg.includes('External transactions to internal accounts cannot include data')) {
                displayMsg = t('forward.nodeRejectError') || '节点拒绝了交易：当前账户尚未完成 EIP-7702 委托授权。请先前往左侧【转发授权】页面签署并执行初始委托，或者更换 RPC 节点重试。';
            } else {
                displayMsg = msg || '代币搬运失败，请确认该代币余额不为 0 且 EOA 代理未过期。';
            }
            setSweepError(displayMsg);
            toast.error(displayMsg, { duration: 5000 });
        } finally {
            setIsSweeping(false);
            setTimeout(() => {
                setSweeping(false);
            }, 500);
        }
    };

    // 操作：批量搬运发现的所有 ERC20 代币
    const handleBatchSweepTokens = async (tokensToSweep) => {
        setSweepError('');
        setSuccessMessage('');
        setIsSweeping('batch');

        try {
            if (!tokensToSweep || tokensToSweep.length === 0) {
                throw new Error("没有可搬运的代币。");
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

            if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
                throw new Error('请选择或输入与【转发授权】一致的委托合约地址。');
            }

            console.log(
                `[Batch Sweep] 交易: 赞助商 ${sponsorAddress} → 操作账户 ${accountAddress} | 批量搬运 ${tokensToSweep.length} 种代币至: ${finalRecipient}`
            );

            const SWEEP_BATCH_ABI = [{
                name: 'sweepTokensTo', type: 'function', stateMutability: 'nonpayable',
                inputs: [{ name: 'tokens', type: 'address[]' }, { name: 'to', type: 'address' }],
                outputs: [],
            }];

            toast.loading(
                `正在由赞助商代付 Gas，批量搬运 ${tokensToSweep.length} 种代币至 ${truncateAddress(finalRecipient)}`,
                { duration: 3000 }
            );

            const userWalletClient = createWalletClient({
                account,
                chain,
                transport: http(rpcUrl),
            });

            const currentNonce = await publicClient.getTransactionCount({
                address: accountAddress
            });

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
                abi: SWEEP_BATCH_ABI,
                functionName: 'sweepTokensTo',
                args: [tokensToSweep, finalRecipient],
            });

            setSweeping(true);

            let hash;
            const eoaCode = await publicClient.getCode({ address: accountAddress });
            const delegatedTo = (eoaCode && eoaCode.startsWith('0xef0100')) 
                ? '0x' + eoaCode.slice(8).toLowerCase() 
                : null;
            const isCorrectDelegation = delegatedTo && delegatedTo === contractAddress.toLowerCase();

            if (isCorrectDelegation) {
                console.log('[Batch Sweep] 检测到账号已存有效委托，将尝试直接调用。');
                try {
                    hash = await sponsorClient.sendTransaction({
                        to: accountAddress,
                        data: callData,
                        value: 0n
                    });
                } catch (e) {
                    console.warn('[Batch Sweep] 直接调用失败，回退到带 authorizationList:', e);
                    hash = await sponsorClient.sendTransaction({
                        authorizationList: [finalAuth],
                        to: accountAddress,
                        data: callData,
                        value: 0n
                    });
                }
            } else {
                hash = await sponsorClient.sendTransaction({
                    authorizationList: [finalAuth],
                    to: accountAddress,
                    data: callData,
                    value: 0n
                });
            }

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            console.log('[Batch Sweep] 交易回执成功:', receipt);

            if (receipt.status !== 'success') {
                throw new Error('交易已上链但执行失败（revert）。常见原因可能是余额不足或不支持的代币。');
            }

            // Check if TokenSweptBatch or TokenSwept event exists in logs
            // TokenSweptBatch: TokenSweptBatch(address[] tokens, address indexed to, uint256[] amounts)
            const tokenSweptBatchTopic = '0x50c5a87e9ad9d7e473abd7dc54c7e75ef949fb7812f33c3ac0ba64121021da79';
            const tokenSweptTopic = '0x115d7b5114b5954762cc233b141a7c777a8f79d93f50af7216d645c87fb4883e';
            const sweepLog = receipt.logs.find(l => l.topics[0] === tokenSweptBatchTopic || l.topics[0] === tokenSweptTopic);
            if (!sweepLog) {
                console.warn('[Batch Sweep] 未检测到 TokenSwept 事件！可能执行了 fallback 或其他逻辑，或者余额为 0 被跳过。');
                throw new Error('授权交易已成功发送，但代币未发生转移。请检查:\n1) 您部署的委托合约版本是否太旧（缺少 sweepTokensTo 方法）\n2) 代币余额是否已被黑客转走\n3) 该代币合约是否不支持标准转账。');
            } else {
                console.log('[Batch Sweep] 检测到 TokenSwept 事件，合约内部批量搬运成功。');
            }

            toast.success(t('forward.sweepSuccess') || `成功批量搬运 ${tokensToSweep.length} 种代币！`);

            // Save to local authorization cache
            saveAuthorization({
                id: `batch-sweep-${Date.now()}`,
                walletAddress: accountAddress,
                delegateContract: contractAddress,
                contractName: deployedContracts.find(c => c.address.toLowerCase() === contractAddress.toLowerCase())?.name || 'AutoForwarder',
                chainId: Number(activeChainId || 11155111),
                status: 'completed',
                timestamp: Date.now(),
                txHash: hash,
                type: 'sweep_batch',
                tokenAddress: 'Multiple Tokens',
                recipient: finalRecipient
            });

            setTimeout(() => {
                handleScanTokens();
            }, 1000);

        } catch (err) {
            console.error(err);
            const msg = err.shortMessage || err.message || 'Batch sweep failed';
            setSweepError(msg);
            toast.error(msg, { duration: 5000 });
        } finally {
            setIsSweeping(false);
            setTimeout(() => {
                setSweeping(false);
            }, 500);
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h4 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>{t('forward.scanAndSweepTitle') || '扫描并搬运已知代币'}</h4>
                            {discoveredTokens.length > 0 && (
                                <span style={{ 
                                    fontSize: '11px', 
                                    background: 'var(--accent-purple)', 
                                    color: 'white', 
                                    padding: '2px 8px', 
                                    borderRadius: '10px',
                                    fontWeight: '600'
                                }}>
                                    {discoveredTokens.length}
                                </span>
                            )}
                        </div>
                        <button className="btn btn-secondary" onClick={handleScanTokens} disabled={isScanningTokens || !privateKey.trim()} style={{ padding: '8px 16px', fontSize: '13px' }} title={t('forward.scanAssetsBtn') || 'Scan Wallet Assets'}>
                            {isScanningTokens ? <><Loader2 size={14} className="spin" /> {t('forward.scanning') || '扫描中...'}</> : <><Search size={14} /> {t('forward.scanAssetsBtn') || '扫描钱包资产'}</>}
                        </button>
                    </div>

                    {discoveredTokens.length > 0 && (
                        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {discoveredTokens.length > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => { handleBatchSweepTokens(discoveredTokens.map(t => t.contractAddress)); }}
                                        disabled={!privateKey.trim() || !sweepSponsorKey.trim() || !sweepRecipient.trim() || isSweeping !== false}
                                        style={{ padding: '8px 20px', fontSize: '14px', background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        {isSweeping === 'batch' ? <Loader2 size={16} className="spin" /> : <><Zap size={16} /> {t('forward.batchSweepBtn') || '一键全部搬运'} ({discoveredTokens.length})</>}
                                    </button>
                                </div>
                            )}
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
