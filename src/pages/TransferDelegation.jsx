import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, Settings, CheckCircle, XCircle, AlertTriangle, Copy, RefreshCw, Send, Loader2, Shield, Zap } from 'lucide-react';
import { createPublicClient, createWalletClient, custom, http, encodeFunctionData, formatEther } from 'viem';
import { sepolia, mainnet } from 'viem/chains';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';
import { truncateAddress } from '../services/wallet';
import { getActiveAuthorizations } from '../services/authorizationCache';
import { getDeployedContracts } from '../services/deployedContracts';

const CHAINS = { 1: mainnet, 11155111: sepolia };
const RPC_URLS = {
    1: 'https://rpc.ankr.com/eth/2012b763b06d70a6f8957933b229023d703ccab6849fb3a0201ecfc92d04aac5',
    11155111: 'https://rpc.ankr.com/eth_sepolia/2012b763b06d70a6f8957933b229023d703ccab6849fb3a0201ecfc92d04aac5',
};

// Minimal ABI for EIP7702AutoForwarder interactions
const FORWARDER_ABI = [
    { name: 'initialize', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_forwardTarget', type: 'address' }, { name: '_gasSponsor', type: 'address' }, { name: '_autoForward', type: 'bool' }], outputs: [] },
    { name: 'setForwardTarget', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_target', type: 'address' }], outputs: [] },
    { name: 'setGasSponsor', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_sponsor', type: 'address' }], outputs: [] },
    { name: 'setAutoForward', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_enabled', type: 'bool' }], outputs: [] },
    { name: 'sweepToken', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }], outputs: [] },
    { name: 'sweepTokens', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokens', type: 'address[]' }], outputs: [] },
    { name: 'forwardAllETH', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
    { name: 'getConfig', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '_forwardTarget', type: 'address' }, { name: '_gasSponsor', type: 'address' }, { name: '_autoForwardEnabled', type: 'bool' }, { name: '_initialized', type: 'bool' }] },
    { name: 'getBalance', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'forwardTarget', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { name: 'gasSponsor', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { name: 'autoForwardEnabled', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
    { name: 'initialized', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
];

export default function TransferDelegation() {
    const { isConnected, address, chainId } = useWallet();
    const { t } = useI18n();

    // Config form
    const [forwardTarget, setForwardTarget] = useState('');
    const [gasSponsor, setGasSponsor] = useState('');
    const [autoForward, setAutoForward] = useState(true);

    // Contract selection
    const [selectedContract, setSelectedContract] = useState('');
    const deployedContracts = getDeployedContracts();
    const activeAuths = getActiveAuthorizations();

    // Current on-chain config
    const [onChainConfig, setOnChainConfig] = useState(null);
    const [configLoading, setConfigLoading] = useState(false);

    // Action states
    const [actionLoading, setActionLoading] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    // ERC20 sweep
    const [tokenAddress, setTokenAddress] = useState('');

    const getClients = useCallback(() => {
        const chain = CHAINS[chainId] || sepolia;
        const rpcUrl = RPC_URLS[chainId];
        const publicClient = createPublicClient({
            chain,
            transport: rpcUrl ? http(rpcUrl) : http(),
        });
        const walletClient = createWalletClient({
            chain,
            transport: custom(window.ethereum),
            account: address,
        });
        return { publicClient, walletClient };
    }, [chainId, address]);

    // Load on-chain config when contract is selected
    const loadConfig = useCallback(async () => {
        if (!selectedContract || !isConnected) return;
        setConfigLoading(true);
        try {
            const { publicClient } = getClients();
            const data = await publicClient.readContract({
                address: selectedContract,
                abi: FORWARDER_ABI,
                functionName: 'getConfig',
            });
            setOnChainConfig({
                forwardTarget: data[0],
                gasSponsor: data[1],
                autoForwardEnabled: data[2],
                initialized: data[3],
            });
        } catch (err) {
            console.log('Config read failed (contract may not be delegated yet):', err.message);
            setOnChainConfig(null);
        } finally {
            setConfigLoading(false);
        }
    }, [selectedContract, isConnected, getClients]);

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    // Custom error selectors for better error messages
    const ERROR_SELECTORS = {
        '0x82b42900': 'Unauthorized — 合约权限校验失败',
        '0xdc149f00': 'AlreadyInitialized — 合约已经初始化过',
        '0xd92e233d': 'ZeroAddress — 目标地址不能为零地址',
        '0x096dc0e1': 'ForwardFailed — ETH 转发失败',
        '0x044c2581': 'TokenTransferFailed — 代币转账失败',
        '0x7bb5ead2': 'NoTokenBalance — 该代币余额为零',
        '0xacfdb444': 'ExecutionFailed — 执行失败',
        '0x09cc6f01': 'LengthMismatch — 参数数组长度不匹配',
    };

    // Helper: send a contract call to the deployed contract
    const sendContractCall = async (functionName, args = []) => {
        const { publicClient } = getClients();
        const data = encodeFunctionData({
            abi: FORWARDER_ABI,
            functionName,
            args,
        });

        const txParams = {
            from: address,
            to: selectedContract,
            data,
            value: '0x0',
        };

        // Pre-flight: simulate with eth_call to catch revert reasons
        try {
            await window.ethereum.request({
                method: 'eth_call',
                params: [txParams, 'latest'],
            });
        } catch (simErr) {
            // Try to decode the revert reason
            const errData = simErr?.data?.originalError?.data || simErr?.data || '';
            const selector = typeof errData === 'string' ? errData.slice(0, 10) : '';
            const decoded = ERROR_SELECTORS[selector];
            if (decoded) {
                throw new Error(decoded);
            }
            throw new Error(`Simulation failed: ${simErr?.message || simErr}`);
        }

        // Actual transaction
        const hash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{ ...txParams, gas: '0x493E0' }],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') {
            throw new Error('Transaction reverted on-chain');
        }
        return { hash, receipt };
    };

    // Initialize the forwarding contract
    const handleInitialize = async () => {
        if (!forwardTarget || !selectedContract) return;
        setActionLoading('init');
        setError('');
        setResult(null);
        try {
            const encodedSponsor = gasSponsor || '0x0000000000000000000000000000000000000000';
            const { hash } = await sendContractCall('initialize', [
                forwardTarget,
                encodedSponsor,
                autoForward,
            ]);
            setResult({ type: 'init', hash, message: t('forward.initSuccess') });

            // Optimistic UI update so it shows "Initialized" immediately
            setOnChainConfig({
                forwardTarget,
                gasSponsor: encodedSponsor,
                autoForwardEnabled: autoForward,
                initialized: true,
            });
            loadConfig();
        } catch (err) {
            setError(err.shortMessage || err.message);
        } finally {
            setActionLoading('');
        }
    };

    // Update forward target
    const handleUpdateTarget = async () => {
        if (!forwardTarget) return;
        setActionLoading('target');
        setError('');
        try {
            const { hash } = await sendContractCall('setForwardTarget', [forwardTarget]);
            setResult({ type: 'target', hash, message: t('forward.targetUpdated') });
            loadConfig();
        } catch (err) {
            setError(err.shortMessage || err.message);
        } finally {
            setActionLoading('');
        }
    };

    // Forward all ETH
    const handleForwardETH = async () => {
        setActionLoading('eth');
        setError('');
        try {
            const { hash } = await sendContractCall('forwardAllETH');
            setResult({ type: 'eth', hash, message: t('forward.ethForwarded') });
        } catch (err) {
            setError(err.shortMessage || err.message);
        } finally {
            setActionLoading('');
        }
    };

    // Sweep ERC20 token
    const handleSweepToken = async () => {
        if (!tokenAddress) return;
        setActionLoading('sweep');
        setError('');
        try {
            const { hash } = await sendContractCall('sweepToken', [tokenAddress]);
            setResult({ type: 'sweep', hash, message: t('forward.tokenSwept') });
        } catch (err) {
            setError(err.shortMessage || err.message);
        } finally {
            setActionLoading('');
        }
    };

    const copyToClipboard = (text) => navigator.clipboard.writeText(text);
    const isZeroAddr = (addr) => !addr || addr === '0x0000000000000000000000000000000000000000';

    return (
        <div className="page-enter">
            <div className="alert alert-info">
                <ArrowRightLeft size={18} />
                <span>{t('forward.infoAlert')}</span>
            </div>

            <div className="page-grid">
                {/* Left: Configuration */}
                <div>
                    {/* Contract Selection */}
                    <div className="card">
                        <div className="card-header">
                            <h3>{t('forward.configTitle')}</h3>
                        </div>
                        <div className="card-body">
                            {/* Select delegated contract */}
                            <div className="form-group">
                                <label className="form-label">{t('forward.selectContract')}</label>
                                <select
                                    className="form-select"
                                    value={selectedContract}
                                    onChange={(e) => setSelectedContract(e.target.value)}
                                >
                                    <option value="">{t('forward.chooseContract')}</option>
                                    {deployedContracts.map((c) => (
                                        <option key={c.address} value={c.address}>
                                            {c.name} — {truncateAddress(c.address)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* On-chain config status */}
                            {selectedContract && (
                                <div className="tx-preview" style={{ marginTop: '16px' }}>
                                    <div className="tx-preview-row">
                                        <span className="tx-preview-label">{t('forward.status')}</span>
                                        <span className="tx-preview-value">
                                            {configLoading ? (
                                                <Loader2 size={14} className="spin" />
                                            ) : onChainConfig?.initialized ? (
                                                <span className="badge badge-active" style={{ fontSize: '11px' }}>
                                                    <CheckCircle size={10} /> {t('forward.initialized')}
                                                </span>
                                            ) : (
                                                <span className="badge badge-pending" style={{ fontSize: '11px' }}>
                                                    {t('forward.notInitialized')}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    {onChainConfig?.initialized && (
                                        <>
                                            <div className="tx-preview-row">
                                                <span className="tx-preview-label">{t('forward.currentTarget')}</span>
                                                <span className="tx-preview-value mono" style={{ fontSize: '12px' }}>
                                                    {isZeroAddr(onChainConfig.forwardTarget) ? '—' : truncateAddress(onChainConfig.forwardTarget)}
                                                </span>
                                            </div>
                                            <div className="tx-preview-row">
                                                <span className="tx-preview-label">{t('forward.currentSponsor')}</span>
                                                <span className="tx-preview-value mono" style={{ fontSize: '12px' }}>
                                                    {isZeroAddr(onChainConfig.gasSponsor) ? t('forward.none') : truncateAddress(onChainConfig.gasSponsor)}
                                                </span>
                                            </div>
                                            <div className="tx-preview-row">
                                                <span className="tx-preview-label">{t('forward.autoForward')}</span>
                                                <span className="tx-preview-value">
                                                    {onChainConfig.autoForwardEnabled ? (
                                                        <span style={{ color: 'var(--accent-green)' }}>✅ {t('forward.enabled')}</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-tertiary)' }}>❌ {t('forward.disabled')}</span>
                                                    )}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Initialize / Update Config */}
                    {selectedContract && (
                        <div className="card" style={{ marginTop: '16px' }}>
                            <div className="card-header">
                                <h3>{onChainConfig?.initialized ? t('forward.updateConfig') : t('forward.initConfig')}</h3>
                            </div>
                            <div className="card-body">
                                <div className="form-group">
                                    <label className="form-label">
                                        <Send size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                        {t('forward.forwardTargetLabel')}
                                    </label>
                                    <input
                                        className="form-input mono"
                                        type="text"
                                        placeholder={t('forward.forwardTargetPlaceholder')}
                                        value={forwardTarget}
                                        onChange={(e) => setForwardTarget(e.target.value)}
                                    />
                                    <div className="form-hint">{t('forward.forwardTargetHint')}</div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        <Shield size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                        {t('forward.gasSponsorLabel')}
                                    </label>
                                    <input
                                        className="form-input mono"
                                        type="text"
                                        placeholder={t('forward.gasSponsorPlaceholder')}
                                        value={gasSponsor}
                                        onChange={(e) => setGasSponsor(e.target.value)}
                                    />
                                    <div className="form-hint">{t('forward.gasSponsorHint')}</div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Zap size={14} />
                                        {t('forward.autoForwardLabel')}
                                    </label>
                                    <div
                                        onClick={() => setAutoForward(!autoForward)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            cursor: 'pointer', padding: '10px 14px',
                                            borderRadius: 'var(--radius-md)',
                                            background: autoForward ? 'rgba(16,185,129,0.1)' : 'var(--bg-glass)',
                                            border: `1px solid ${autoForward ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <div style={{
                                            width: '40px', height: '22px', borderRadius: '11px',
                                            background: autoForward ? 'var(--accent-green)' : 'var(--bg-elevated)',
                                            position: 'relative', transition: 'background 0.2s',
                                        }}>
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '50%',
                                                background: 'white', position: 'absolute', top: '2px',
                                                left: autoForward ? '20px' : '2px', transition: 'left 0.2s',
                                            }} />
                                        </div>
                                        <span style={{ fontSize: '13px', color: autoForward ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                                            {autoForward ? t('forward.autoForwardOn') : t('forward.autoForwardOff')}
                                        </span>
                                    </div>
                                </div>

                                {/* Error */}
                                {error && (
                                    <div className="alert alert-error" style={{ marginBottom: '12px' }}>
                                        <AlertTriangle size={16} />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Success */}
                                {result && (
                                    <div className="alert alert-success" style={{ marginBottom: '12px' }}>
                                        <CheckCircle size={16} />
                                        <span>{result.message}</span>
                                    </div>
                                )}

                                {!onChainConfig?.initialized ? (
                                    <button
                                        className="btn btn-primary btn-lg btn-full"
                                        onClick={handleInitialize}
                                        disabled={!forwardTarget || actionLoading === 'init'}
                                    >
                                        {actionLoading === 'init' ? (
                                            <><Loader2 size={16} className="spin" /> {t('forward.initializing')}</>
                                        ) : (
                                            <><Settings size={16} /> {t('forward.initializeBtn')}</>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-primary btn-lg btn-full"
                                        onClick={handleUpdateTarget}
                                        disabled={!forwardTarget || actionLoading === 'target'}
                                    >
                                        {actionLoading === 'target' ? (
                                            <><Loader2 size={16} className="spin" /> {t('forward.updating')}</>
                                        ) : (
                                            <><RefreshCw size={16} /> {t('forward.updateTargetBtn')}</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Operations */}
                <div>
                    {/* How it works */}
                    <div className="card">
                        <div className="card-header">
                            <h3>{t('forward.howItWorks')}</h3>
                        </div>
                        <div className="card-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                {[
                                    { num: '1', title: t('forward.step1Title'), desc: t('forward.step1Desc') },
                                    { num: '2', title: t('forward.step2Title'), desc: t('forward.step2Desc') },
                                    { num: '3', title: t('forward.step3Title'), desc: t('forward.step3Desc') },
                                    { num: '4', title: t('forward.step4Title'), desc: t('forward.step4Desc') },
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '14px' }}>
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '50%',
                                            background: 'var(--accent-blue)', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            fontSize: '12px', fontWeight: '700', color: 'white', flexShrink: 0,
                                        }}>
                                            {item.num}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{item.title}</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{item.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    {onChainConfig?.initialized && (
                        <div className="card" style={{ marginTop: '16px' }}>
                            <div className="card-header">
                                <h3>{t('forward.quickActions')}</h3>
                            </div>
                            <div className="card-body">
                                {/* Forward all ETH */}
                                <button
                                    className="btn btn-secondary btn-full"
                                    onClick={handleForwardETH}
                                    disabled={actionLoading === 'eth'}
                                    style={{ marginBottom: '12px' }}
                                >
                                    {actionLoading === 'eth' ? (
                                        <><Loader2 size={14} className="spin" /> {t('forward.forwarding')}</>
                                    ) : (
                                        <><Send size={14} /> {t('forward.forwardAllETH')}</>
                                    )}
                                </button>

                                {/* Sweep ERC20 */}
                                <div className="form-group">
                                    <label className="form-label">{t('forward.sweepTokenLabel')}</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            className="form-input mono"
                                            type="text"
                                            placeholder={t('forward.tokenAddressPlaceholder')}
                                            value={tokenAddress}
                                            onChange={(e) => setTokenAddress(e.target.value)}
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            className="btn btn-secondary"
                                            onClick={handleSweepToken}
                                            disabled={!tokenAddress || actionLoading === 'sweep'}
                                        >
                                            {actionLoading === 'sweep' ? (
                                                <Loader2 size={14} className="spin" />
                                            ) : (
                                                t('forward.sweep')
                                            )}
                                        </button>
                                    </div>
                                    <div className="form-hint">{t('forward.sweepHint')}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
