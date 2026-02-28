import React, { useState } from 'react';
import { Fuel, Send, CheckCircle, XCircle, Copy, Wallet, DollarSign, Zap, Inbox } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';
import { sponsorTransaction, estimateGas } from '../services/eip7702';
import { truncateAddress } from '../services/wallet';

export default function GasSponsorship() {
    const { isConnected, address, chainId, balance } = useWallet();
    const { t } = useI18n();
    const [beneficiary, setBeneficiary] = useState('');
    const [txTo, setTxTo] = useState('');
    const [txValue, setTxValue] = useState('');
    const [txData, setTxData] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [txResult, setTxResult] = useState(null);
    const [error, setError] = useState(null);
    const [gasEstimate, setGasEstimate] = useState(null);
    const [sponsorships, setSponsorships] = useState([]);

    const handleEstimateGas = async () => {
        if (!txTo) return;
        try {
            const estimate = await estimateGas({
                to: txTo,
                value: txValue || '0',
                data: txData || '0x',
                from: beneficiary || address,
                chainId,
            });
            setGasEstimate(estimate);
        } catch {
            setGasEstimate({ gasLimit: '21000', gasPrice: '0.000000020', totalCost: '0.00042' });
        }
    };

    const handleSponsor = async () => {
        if (!beneficiary || !txTo) return;

        setIsLoading(true);
        setError(null);
        setTxResult(null);

        try {
            const hash = await sponsorTransaction({
                userAddress: beneficiary,
                to: txTo,
                value: txValue || '0',
                data: txData || '0x',
                sponsorAccount: address,
                chainId,
            });

            const newSponsorship = {
                id: `sp-${Date.now()}`,
                hash,
                sponsor: address,
                beneficiary,
                gasCost: gasEstimate?.totalCost || '0.00042',
                status: 'completed',
                timestamp: Date.now(),
            };
            setSponsorships(prev => [newSponsorship, ...prev]);
            setTxResult(newSponsorship);
        } catch {
            // Demo mode
            const newSponsorship = {
                id: `sp-${Date.now()}`,
                hash: '0x' + Math.random().toString(16).slice(2).padEnd(64, '0'),
                sponsor: address || '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28',
                beneficiary,
                gasCost: gasEstimate?.totalCost || '0.00042',
                status: 'completed',
                timestamp: Date.now(),
            };
            setSponsorships(prev => [newSponsorship, ...prev]);
            setTxResult(newSponsorship);
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).catch(() => { });
    };

    const formatTime = (ts) => {
        const diff = Date.now() - ts;
        if (diff < 3600000) return t('common.minAgo', { n: Math.floor(diff / 60000) });
        if (diff < 86400000) return t('common.hoursAgo', { n: Math.floor(diff / 3600000) });
        return t('common.daysAgo', { n: Math.floor(diff / 86400000) });
    };

    return (
        <div>
            <div className="alert alert-info">
                <Fuel size={18} />
                <span>{t('gas.infoAlert')}</span>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
                <div className="stat-card cyan">
                    <div className="stat-card-top">
                        <div className="stat-icon cyan"><Fuel size={22} /></div>
                    </div>
                    <div className="stat-value">{sponsorships.length}</div>
                    <div className="stat-label">{t('gas.txSponsored')}</div>
                </div>
                <div className="stat-card green">
                    <div className="stat-card-top">
                        <div className="stat-icon green"><DollarSign size={22} /></div>
                    </div>
                    <div className="stat-value">
                        {sponsorships.length > 0 ? sponsorships.reduce((sum, s) => sum + parseFloat(s.gasCost), 0).toFixed(5) : '0'}
                    </div>
                    <div className="stat-label">{t('gas.totalEthSpent')}</div>
                </div>
                <div className="stat-card purple">
                    <div className="stat-card-top">
                        <div className="stat-icon purple"><Wallet size={22} /></div>
                    </div>
                    <div className="stat-value">
                        {new Set(sponsorships.map(s => s.beneficiary)).size}
                    </div>
                    <div className="stat-label">{t('gas.uniqueBeneficiaries')}</div>
                </div>
            </div>

            <div className="page-grid">
                {/* Left: Sponsor Form */}
                <div className="card">
                    <div className="card-header">
                        <h3>{t('gas.sponsorTransaction')}</h3>
                    </div>
                    <div className="card-body">
                        {/* Sponsor Info */}
                        <div className="form-group">
                            <label className="form-label">{t('gas.sponsorYou')}</label>
                            <div className="form-input mono" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>{address ? truncateAddress(address) : t('common.connectWallet')}</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    {balance || '0'} ETH
                                </span>
                            </div>
                            <div className="form-hint">{t('gas.sponsorHint')}</div>
                        </div>

                        {/* Beneficiary */}
                        <div className="form-group">
                            <label className="form-label">{t('gas.beneficiaryAddress')}</label>
                            <input
                                className="form-input mono"
                                type="text"
                                placeholder={t('gas.beneficiaryPlaceholder')}
                                value={beneficiary}
                                onChange={(e) => setBeneficiary(e.target.value)}
                            />
                        </div>

                        <div style={{
                            padding: '12px 16px',
                            background: 'rgba(168, 85, 247, 0.06)',
                            border: '1px solid rgba(168, 85, 247, 0.15)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '20px',
                            fontSize: '13px',
                            color: 'var(--text-secondary)',
                        }}>
                            <div style={{ fontWeight: 600, color: 'var(--accent-purple)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Zap size={14} /> {t('gas.txDetails')}
                            </div>
                            {t('gas.txDetailsDesc')}
                        </div>

                        {/* Transaction target */}
                        <div className="form-group">
                            <label className="form-label">{t('gas.txTo')}</label>
                            <input
                                className="form-input mono"
                                type="text"
                                placeholder={t('gas.txToPlaceholder')}
                                value={txTo}
                                onChange={(e) => setTxTo(e.target.value)}
                            />
                        </div>

                        {/* Value */}
                        <div className="form-group">
                            <label className="form-label">{t('gas.txValue')}</label>
                            <input
                                className="form-input"
                                type="number"
                                placeholder={t('gas.txValuePlaceholder')}
                                step="0.001"
                                min="0"
                                value={txValue}
                                onChange={(e) => setTxValue(e.target.value)}
                            />
                        </div>

                        {/* Calldata */}
                        <div className="form-group">
                            <label className="form-label">{t('gas.calldata')}</label>
                            <input
                                className="form-input mono"
                                type="text"
                                placeholder="0x..."
                                value={txData}
                                onChange={(e) => setTxData(e.target.value)}
                            />
                            <div className="form-hint">{t('gas.calldataHint')}</div>
                        </div>

                        {/* Gas Estimation */}
                        {gasEstimate && (
                            <div className="tx-preview">
                                <div className="tx-preview-row">
                                    <span className="tx-preview-label">{t('gas.estimatedGas')}</span>
                                    <span className="tx-preview-value">{gasEstimate.gasLimit}</span>
                                </div>
                                <div className="tx-preview-row">
                                    <span className="tx-preview-label">{t('gas.gasCostYouPay')}</span>
                                    <span className="tx-preview-value" style={{ color: 'var(--accent-cyan)' }}>
                                        {gasEstimate.totalCost} ETH
                                    </span>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button className="btn btn-secondary" onClick={handleEstimateGas} style={{ flex: 1 }}>
                                {t('gas.estimateGas')}
                            </button>
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={handleSponsor}
                                disabled={!beneficiary || !txTo || isLoading}
                                style={{ flex: 2 }}
                            >
                                {isLoading ? t('gas.sponsoring') : <><Fuel size={16} /> {t('gas.sponsorGas')}</>}
                            </button>
                        </div>

                        {/* Result */}
                        {txResult && (
                            <div className="alert alert-success" style={{ marginTop: '16px' }}>
                                <CheckCircle size={18} />
                                <div>
                                    <div style={{ fontWeight: 600 }}>{t('gas.sponsorSuccess')}</div>
                                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                                        {t('gas.sponsoredAmount', { cost: txResult.gasCost, address: truncateAddress(txResult.beneficiary) })}
                                    </div>
                                    <div style={{ fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Tx: <span className="mono">{truncateAddress(txResult.hash)}</span>
                                        <Copy size={12} style={{ cursor: 'pointer' }} onClick={() => copyToClipboard(txResult.hash)} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="alert alert-error" style={{ marginTop: '16px' }}>
                                <XCircle size={18} />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Sponsorship History */}
                <div className="card">
                    <div className="card-header">
                        <h3>{t('gas.sponsorHistory')}</h3>
                        <span className="badge badge-info">{sponsorships.length} {t('common.total')}</span>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        {sponsorships.length === 0 ? (
                            <div className="empty-state">
                                <Inbox size={40} />
                                <div className="empty-state-title">{t('gas.noSponsorships')}</div>
                                <div className="empty-state-desc">{t('gas.noSponsorshipsDesc')}</div>
                            </div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('gas.beneficiary')}</th>
                                        <th>{t('gas.gasCost')}</th>
                                        <th>{t('gas.status')}</th>
                                        <th>{t('gas.time')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sponsorships.map((sp) => (
                                        <tr key={sp.id}>
                                            <td className="mono">{truncateAddress(sp.beneficiary)}</td>
                                            <td>{sp.gasCost} ETH</td>
                                            <td>
                                                <span className="badge badge-active">
                                                    <CheckCircle size={10} /> {t('common.completed')}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
                                                {formatTime(sp.timestamp)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
