import React, { useState, useMemo } from 'react';
import { Rocket, CheckCircle, AlertTriangle, Copy, ExternalLink, Loader2, Upload, Code } from 'lucide-react';
import { createWalletClient, createPublicClient, custom, http } from 'viem';
import { sepolia, mainnet, holesky } from 'viem/chains';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';
import { CONTRACT_REGISTRY } from '../services/contractABI';
import { saveDeployedContract } from '../services/deployedContracts';
import { RPC_URLS } from '../config';

const CHAINS = { 1: mainnet, 11155111: sepolia, 17000: holesky };

const EXPLORERS = {
    1: 'https://etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    17000: 'https://holesky.etherscan.io',
};

export default function DeployContract() {
    const { isConnected, address, chainId } = useWallet();
    const { t } = useI18n();

    // Contract selection
    const [selectedContractId, setSelectedContractId] = useState(
        CONTRACT_REGISTRY.length > 0 ? CONTRACT_REGISTRY[0].id : 'custom'
    );
    const [customAbi, setCustomAbi] = useState('');
    const [customBytecode, setCustomBytecode] = useState('');
    const [customName, setCustomName] = useState('');

    // Deploy state
    const [deploying, setDeploying] = useState(false);
    const [deployedAddress, setDeployedAddress] = useState('');
    const [txHash, setTxHash] = useState('');
    const [error, setError] = useState('');
    const [step, setStep] = useState(1); // 1=ready, 2=deploying, 3=done

    const isCustom = selectedContractId === 'custom';
    const selectedContract = useMemo(
        () => CONTRACT_REGISTRY.find((c) => c.id === selectedContractId),
        [selectedContractId]
    );

    // Parse custom ABI
    const parsedCustomAbi = useMemo(() => {
        if (!customAbi.trim()) return null;
        try {
            return JSON.parse(customAbi);
        } catch {
            return null;
        }
    }, [customAbi]);

    const canDeploy = useMemo(() => {
        if (!isConnected) return false;
        if (isCustom) {
            return parsedCustomAbi && customBytecode.trim().startsWith('0x');
        }
        return !!selectedContract;
    }, [isConnected, isCustom, parsedCustomAbi, customBytecode, selectedContract]);

    const handleDeploy = async () => {
        if (!canDeploy || !window.ethereum) return;
        setError('');
        setDeploying(true);
        setStep(2);

        try {
            const chain = CHAINS[chainId] || sepolia;
            const rpcUrl = RPC_URLS[chainId];

            const abi = isCustom ? parsedCustomAbi : selectedContract.abi;
            const bytecode = isCustom ? customBytecode.trim() : selectedContract.bytecode;

            const walletClient = createWalletClient({
                chain,
                transport: custom(window.ethereum),
                account: address,
            });

            const publicClient = createPublicClient({
                chain,
                transport: rpcUrl ? http(rpcUrl) : custom(window.ethereum),
            });

            const hash = await walletClient.deployContract({
                abi,
                bytecode,
                account: address,
            });

            setTxHash(hash);

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            setDeployedAddress(receipt.contractAddress);
            // Cache deployed contract for Authorization page
            saveDeployedContract({
                name: isCustom ? (customName || 'Custom Contract') : selectedContract.name,
                address: receipt.contractAddress,
                chainId,
            });
            setStep(3);
        } catch (err) {
            console.error('Deploy error:', err);
            setError(err.shortMessage || err.message || t('deploy.failed'));
            setStep(1);
        } finally {
            setDeploying(false);
        }
    };

    const copyToClipboard = (text) => navigator.clipboard.writeText(text);

    const getExplorerUrl = (hash, type = 'tx') => {
        const base = EXPLORERS[chainId] || 'https://sepolia.etherscan.io';
        return `${base}/${type}/${hash}`;
    };

    const truncate = (str) => {
        if (!str) return '';
        return str.slice(0, 10) + '...' + str.slice(-8);
    };

    const displayName = isCustom
        ? (customName || t('deploy.customContract'))
        : (selectedContract?.name || '');

    return (
        <div className="page-enter">
            {/* Info Alert */}
            <div className="alert alert-info">
                <Rocket size={18} />
                <span>{t('deploy.infoAlert')}</span>
            </div>

            <div className="page-grid">
                {/* Deploy Card */}
                <div>
                    <div className="card">
                        <div className="card-header">
                            <h3>{t('deploy.deployContract')}</h3>
                        </div>
                        <div className="card-body">
                            {/* Contract Selector */}
                            <div className="form-group">
                                <label className="form-label">{t('deploy.selectContract')}</label>
                                <select
                                    className="form-select"
                                    value={selectedContractId}
                                    onChange={(e) => {
                                        setSelectedContractId(e.target.value);
                                        setError('');
                                    }}
                                >
                                    {CONTRACT_REGISTRY.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            ✅ {c.name}
                                        </option>
                                    ))}
                                    <option value="custom">📝 {t('deploy.customContract')}</option>
                                </select>
                                {!isCustom && selectedContract && (
                                    <div className="form-hint" style={{ marginTop: '6px' }}>
                                        {selectedContract.description}
                                    </div>
                                )}
                            </div>

                            {/* Registry Contract Details */}
                            {!isCustom && selectedContract && (
                                <>
                                    <div className="tx-preview" style={{ marginTop: '16px' }}>
                                        <div className="tx-preview-row">
                                            <span className="tx-preview-label">{t('deploy.contractName')}</span>
                                            <span className="tx-preview-value">{selectedContract.name}</span>
                                        </div>
                                        <div className="tx-preview-row">
                                            <span className="tx-preview-label">{t('deploy.compiler')}</span>
                                            <span className="tx-preview-value">{selectedContract.compiler}</span>
                                        </div>
                                        <div className="tx-preview-row">
                                            <span className="tx-preview-label">{t('deploy.evmTarget')}</span>
                                            <span className="tx-preview-value">{selectedContract.evmTarget}</span>
                                        </div>
                                        <div className="tx-preview-row">
                                            <span className="tx-preview-label">{t('deploy.deployer')}</span>
                                            <span className="tx-preview-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                                                {isConnected ? truncate(address) : t('deploy.notConnected')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Features */}
                                    <div style={{ marginTop: '20px', marginBottom: '24px' }}>
                                        <div className="form-label">{t('deploy.features')}</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {selectedContract.features.map((featureKey, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                    <CheckCircle size={14} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                                                    <span>{t(featureKey) || featureKey}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Custom Contract Input */}
                            {isCustom && (
                                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div className="form-group">
                                        <label className="form-label">{t('deploy.contractName')}</label>
                                        <input
                                            className="form-input"
                                            type="text"
                                            placeholder="MyContract"
                                            value={customName}
                                            onChange={(e) => setCustomName(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">
                                            <Code size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                            ABI (JSON)
                                        </label>
                                        <textarea
                                            className="form-input"
                                            rows={5}
                                            placeholder='[{"inputs":[],"name":"myFunction",...}]'
                                            value={customAbi}
                                            onChange={(e) => setCustomAbi(e.target.value)}
                                            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', resize: 'vertical' }}
                                        />
                                        {customAbi.trim() && !parsedCustomAbi && (
                                            <span style={{ color: 'var(--accent-red)', fontSize: '12px', marginTop: '4px' }}>
                                                {t('deploy.invalidAbi')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">
                                            <Upload size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                            Bytecode
                                        </label>
                                        <textarea
                                            className="form-input"
                                            rows={3}
                                            placeholder="0x6080604052..."
                                            value={customBytecode}
                                            onChange={(e) => setCustomBytecode(e.target.value)}
                                            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', resize: 'vertical' }}
                                        />
                                    </div>
                                    <div className="tx-preview">
                                        <div className="tx-preview-row">
                                            <span className="tx-preview-label">{t('deploy.deployer')}</span>
                                            <span className="tx-preview-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                                                {isConnected ? truncate(address) : t('deploy.notConnected')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                                    <AlertTriangle size={16} />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Deploy Button */}
                            {step < 3 && (
                                <button
                                    className="btn btn-primary btn-lg btn-full"
                                    onClick={handleDeploy}
                                    disabled={!canDeploy || deploying}
                                    style={{ marginTop: '8px' }}
                                >
                                    {deploying ? (
                                        <>
                                            <Loader2 size={18} className="spin" />
                                            {t('deploy.deploying')}
                                        </>
                                    ) : (
                                        <>
                                            <Rocket size={18} />
                                            {isConnected ? t('deploy.deployNow') : t('common.connectWallet')}
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Success */}
                            {step === 3 && (
                                <div style={{ marginTop: '8px' }}>
                                    <div className="alert alert-success">
                                        <CheckCircle size={18} />
                                        <span>{t('deploy.success')}</span>
                                    </div>

                                    <div className="tx-preview">
                                        <div className="tx-preview-row">
                                            <span className="tx-preview-label">{t('deploy.contractName')}</span>
                                            <span className="tx-preview-value">{displayName}</span>
                                        </div>
                                        <div className="tx-preview-row">
                                            <span className="tx-preview-label">{t('deploy.contractAddress')}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span className="tx-preview-value" style={{ fontSize: '12px' }}>
                                                    {truncate(deployedAddress)}
                                                </span>
                                                <button
                                                    onClick={() => copyToClipboard(deployedAddress)}
                                                    style={{ padding: '4px', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-secondary)' }}
                                                    title="Copy"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                                <a
                                                    href={getExplorerUrl(deployedAddress, 'address')}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: 'var(--accent-blue)' }}
                                                >
                                                    <ExternalLink size={14} />
                                                </a>
                                            </div>
                                        </div>
                                        <div className="tx-preview-row">
                                            <span className="tx-preview-label">{t('auth.txHash')}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span className="tx-preview-value" style={{ fontSize: '12px' }}>
                                                    {truncate(txHash)}
                                                </span>
                                                <button
                                                    onClick={() => copyToClipboard(txHash)}
                                                    style={{ padding: '4px', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-secondary)' }}
                                                    title="Copy"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                                <a
                                                    href={getExplorerUrl(txHash, 'tx')}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: 'var(--accent-blue)' }}
                                                >
                                                    <ExternalLink size={14} />
                                                </a>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        className="btn btn-secondary btn-full"
                                        onClick={() => {
                                            setStep(1);
                                            setDeployedAddress('');
                                            setTxHash('');
                                        }}
                                        style={{ marginTop: '12px' }}
                                    >
                                        <Rocket size={16} />
                                        {t('deploy.deployAnother')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column - Steps Guide */}
                <div>
                    <div className="card">
                        <div className="card-header">
                            <h3>{t('deploy.howItWorks')}</h3>
                        </div>
                        <div className="card-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {[
                                    { num: '1', title: t('deploy.step1Title'), desc: t('deploy.step1Desc') },
                                    { num: '2', title: t('deploy.step2Title'), desc: t('deploy.step2Desc') },
                                    { num: '3', title: t('deploy.step3Title'), desc: t('deploy.step3Desc') },
                                    { num: '4', title: t('deploy.step4Title'), desc: t('deploy.step4Desc') },
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '14px' }}>
                                        <div
                                            style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                background: step > parseInt(item.num) ? 'var(--accent-green)' : (step === parseInt(item.num) ? 'var(--accent-blue)' : 'var(--bg-glass)'),
                                                border: step >= parseInt(item.num) ? 'none' : '1px solid var(--border-subtle)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '12px',
                                                fontWeight: '700',
                                                color: step >= parseInt(item.num) ? 'white' : 'var(--text-tertiary)',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {step > parseInt(item.num) ? '✓' : item.num}
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

                    {/* Network Warning */}
                    <div className="card" style={{ marginTop: '16px' }}>
                        <div className="card-body">
                            <div className="alert alert-warning" style={{ margin: 0 }}>
                                <AlertTriangle size={16} />
                                <span>{t('deploy.networkWarning')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
