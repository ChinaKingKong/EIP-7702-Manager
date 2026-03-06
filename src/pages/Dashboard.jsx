import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle, XCircle, Clock, Zap, Inbox, ExternalLink, Loader2,
    Coins, Image as ImageIcon, Shield
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';
import { formatEther } from 'viem';
import { truncateAddress } from '../services/wallet';
import { getAuthorizations } from '../services/authorizationCache';

const ETHERSCAN_API = {
    // ETHERSCAN apis might be blocked/timeout in some regions or require an API key, using blockscout which is 100% compatible
    1: 'https://eth.blockscout.com/api',
    11155111: 'https://eth-sepolia.blockscout.com/api',
    17000: 'https://eth-holesky.blockscout.com/api',
};

const EXPLORER_URL = {
    1: 'https://etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    17000: 'https://holesky.etherscan.io',
};

export default function Dashboard() {
    const { isConnected, address, chainId, disconnectedChainId } = useWallet();
    const navigate = useNavigate();
    const { t } = useI18n();
    const activeChainId = isConnected ? chainId : disconnectedChainId;

    const [recentTxs, setRecentTxs] = useState([]);
    const [loadingTxs, setLoadingTxs] = useState(false);
    const [stats, setStats] = useState({
        activeAuths: 0,
        totalTransfers: 0,
        sponsoredGas: 0,
        totalAuths: 0
    });

    // Calculate stats from local cache
    useEffect(() => {
        if (!address) {
            setStats({ activeAuths: 0, totalTransfers: 0, sponsoredGas: 0, totalAuths: 0 });
            return;
        }

        const allAuths = getAuthorizations();
        const targetAddresses = [address.toLowerCase()];

        const auths = allAuths.filter(a =>
            targetAddresses.includes(a.walletAddress?.toLowerCase()) &&
            Number(a.chainId) === Number(activeChainId)
        );

        const activeAuths = auths.filter(a => a.status === 'active' && a.type !== 'sweep').length;
        const totalTransfers = auths.filter(a => a.type === 'sweep' && a.status === 'completed').length;
        const totalAuths = auths.filter(a => a.type !== 'sweep').length;

        // Mock sponsored gas calculation - in a real app this would sum gas from receipts
        const sponsoredGas = totalTransfers * 0.0005;

        setStats({
            activeAuths,
            totalTransfers,
            sponsoredGas,
            totalAuths
        });
    }, [address, activeChainId]);

    const fetchRecentTxs = useCallback(async () => {
        if (!isConnected || !address || !ETHERSCAN_API[chainId]) {
            setRecentTxs([]);
            return;
        }

        try {
            const url = `${ETHERSCAN_API[activeChainId] || ETHERSCAN_API[11155111]}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.status === '1' && Array.isArray(data.result)) {
                setRecentTxs(data.result);
            } else {
                setRecentTxs([]); // Probably no transactions yet
            }
        } catch (err) {
            console.error('Failed to fetch transactions:', err);
            setRecentTxs([]);
        } finally {
            setLoadingTxs(false);
        }
    }, [isConnected, address, activeChainId]); // Changed chainId to activeChainId here

    useEffect(() => {
        fetchRecentTxs();
    }, [fetchRecentTxs]);

    const formatTime = (timestamp) => {
        const diff = Date.now() / 1000 - parseInt(timestamp);
        if (diff < 60) return t('common.justNow');
        if (diff < 3600) return t('common.minAgo', { n: Math.floor(diff / 60) });
        if (diff < 86400) return t('common.hoursAgo', { n: Math.floor(diff / 3600) });
        return t('common.daysAgo', { n: Math.floor(diff / 86400) });
    };

    const getExplorerUrl = (hash) => {
        return `${EXPLORER_URL[chainId] || EXPLORER_URL[11155111]}/tx/${hash}`;
    };

    return (
        <div>
            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card blue">
                    <div className="stat-card-top">
                        <div className="stat-icon blue">
                            <Shield size={22} />
                        </div>
                    </div>
                    <div className="stat-value">{stats.activeAuths}</div>
                    <div className="stat-label">{t('dashboard.activeAuthorizations')}</div>
                </div>

                <div className="stat-card green">
                    <div className="stat-card-top">
                        <div className="stat-icon green">
                            <ArrowRightLeft size={22} />
                        </div>
                    </div>
                    <div className="stat-value">{stats.totalTransfers}</div>
                    <div className="stat-label">{t('dashboard.totalTransfers')}</div>
                </div>

                <div className="stat-card purple">
                    <div className="stat-card-top">
                        <div className="stat-icon purple">
                            <Fuel size={22} />
                        </div>
                    </div>
                    <div className="stat-value">~{stats.sponsoredGas.toFixed(4)}</div>
                    <div className="stat-label">{t('dashboard.ethGasSponsored')}</div>
                </div>

                <div className="stat-card cyan">
                    <div className="stat-card-top">
                        <div className="stat-icon cyan">
                            <Zap size={22} />
                        </div>
                    </div>
                    <div className="stat-value">{stats.totalAuths}</div>
                    <div className="stat-label">{t('dashboard.totalAuthorizations')}</div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="page-grid-wide">
                {/* Recent Activity */}
                <div className="card">
                    <div className="card-header">
                        <h3>{t('dashboard.recentActivity')}</h3>
                        <span className="badge badge-info">
                            <Activity size={12} /> {t('common.live')}
                        </span>
                    </div>
                    <div className="card-body" style={{ padding: '0' }}>
                        {!isConnected ? (
                            <div className="empty-state" style={{ padding: '30px' }}>
                                <Clock size={32} />
                                <div className="empty-state-title" style={{ marginTop: '12px' }}>{t('common.connectToStart')}</div>
                                <div className="empty-state-desc">{t('dashboard.connectWalletToSeeActivity')}</div>
                            </div>
                        ) : loadingTxs ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                <Loader2 size={24} className="spin" style={{ color: 'var(--text-tertiary)' }} />
                            </div>
                        ) : recentTxs.length === 0 ? (
                            <div className="empty-state" style={{ padding: '30px' }}>
                                <Inbox size={32} />
                                <div className="empty-state-title" style={{ marginTop: '12px' }}>{t('dashboard.noActivity')}</div>
                                <div className="empty-state-desc">{t('dashboard.noActivityDesc')}</div>
                            </div>
                        ) : (
                            <table className="data-table">
                                <tbody>
                                    {recentTxs.map((tx) => {
                                        const localAuth = getAuthorizations().find(a => a.txHash?.toLowerCase() === tx.hash?.toLowerCase());
                                        const isError = tx.isError !== '0';
                                        const isReceived = tx.to.toLowerCase() === address.toLowerCase();

                                        return (
                                            <tr key={tx.hash}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '50%',
                                                        background: localAuth && (localAuth.type === 'sweep' || localAuth.type === 'nft_sweep') ? 'rgba(168,85,247,0.1)' : (isError ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'),
                                                        color: localAuth && (localAuth.type === 'sweep' || localAuth.type === 'nft_sweep') ? 'var(--accent-purple)' : (isError ? 'var(--accent-red)' : 'var(--accent-green)'),
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        {localAuth ? (
                                                            localAuth.type === 'sweep' ? <Coins size={16} /> :
                                                            localAuth.type === 'nft_sweep' ? <ImageIcon size={16} /> :
                                                            <Shield size={16} />
                                                        ) : (
                                                            isError ? <XCircle size={16} /> : <CheckCircle size={16} />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '500', fontSize: '13px' }}>
                                                            {localAuth ? (
                                                                localAuth.type === 'sweep' ? (localAuth.isBatch ? t('auth.sweptBatch', { n: localAuth.count }) : t('forward.sweepTokenLabel')) :
                                                                localAuth.type === 'nft_sweep' ? (localAuth.isBatch ? t('auth.sweptBatch', { n: localAuth.count }) : t('forward.sweepNftLabel')) :
                                                                localAuth.contractName || t('forward.selectContract')
                                                            ) : (
                                                                isReceived ? t('common.receive') : t('common.send')
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                                                            {localAuth && (localAuth.type === 'sweep' || localAuth.type === 'nft_sweep') ? 
                                                                `${t('auth.to')} ${truncateAddress(localAuth.recipient)}` : 
                                                                truncateAddress(isReceived ? tx.from : tx.to)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: '600', fontSize: '13px' }}>
                                                    {parseFloat(formatEther(tx.value)).toFixed(4)} ETH
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                    {formatTime(tx.timeStamp)}
                                                </div>
                                            </td>
                                            <td style={{ width: '40px', textAlign: 'center' }}>
                                                <a href={getExplorerUrl(tx.hash)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-tertiary)' }} title={t('common.viewOnExplorer') || "View on Explorer"}>
                                                    <ExternalLink size={14} />
                                                </a>
                                            </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="card">
                        <div className="card-header">
                            <h3>{t('dashboard.quickActions')}</h3>
                        </div>
                        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button className="btn btn-primary btn-full" onClick={() => navigate('/authorization')}>
                                <Shield size={16} /> {t('dashboard.newAuthorization')}
                            </button>
                            <button className="btn btn-success btn-full" onClick={() => navigate('/transfer')}>
                                <ArrowRightLeft size={16} /> {t('dashboard.delegatedTransfer')}
                            </button>
                            <button className="btn btn-secondary btn-full" onClick={() => navigate('/gas-sponsorship')}>
                                <Fuel size={16} /> {t('dashboard.sponsorGas')}
                            </button>
                        </div>
                    </div>

                    {/* Protocol Info */}
                    <div className="card">
                        <div className="card-header">
                            <h3>{t('dashboard.aboutEIP7702')}</h3>
                        </div>
                        <div className="card-body">
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                {t('dashboard.aboutDescription')}
                                <strong style={{ color: 'var(--text-accent)' }}>{t('dashboard.accountAbstraction')}</strong>
                                {', '}
                                <strong style={{ color: 'var(--accent-green)' }}>{t('dashboard.batchTransactions')}</strong>
                                {', '}
                                <strong style={{ color: 'var(--accent-cyan)' }}>{t('dashboard.gasSponsorshipFeature')}</strong>
                                {', '}
                                <strong style={{ color: 'var(--accent-purple)' }}>{t('dashboard.delegatedActions')}</strong>
                                {'。'}
                            </p>
                            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <span className="badge badge-info">{t('dashboard.pectraUpgrade')}</span>
                                <span className="badge badge-active">{t('dashboard.erc4337Compatible')}</span>
                                <span className="badge badge-pending">{t('dashboard.type04')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Connection Status */}
                    <div className="card">
                        <div className="card-body" style={{ textAlign: 'center', padding: '20px' }}>
                            {isConnected ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <CheckCircle size={18} style={{ color: 'var(--accent-green)' }} />
                                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--accent-green)' }}>{t('common.walletConnected')}</span>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Clock size={18} style={{ color: 'var(--accent-amber)' }} />
                                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--accent-amber)' }}>{t('common.connectToStart')}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
