import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, ArrowRightLeft, Fuel, TrendingUp, Activity,
    CheckCircle, XCircle, Clock, Zap, Inbox
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';

export default function Dashboard() {
    const { isConnected } = useWallet();
    const navigate = useNavigate();
    const { t } = useI18n();

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
                    <div className="stat-value">0</div>
                    <div className="stat-label">{t('dashboard.activeAuthorizations')}</div>
                </div>

                <div className="stat-card green">
                    <div className="stat-card-top">
                        <div className="stat-icon green">
                            <ArrowRightLeft size={22} />
                        </div>
                    </div>
                    <div className="stat-value">0</div>
                    <div className="stat-label">{t('dashboard.totalTransfers')}</div>
                </div>

                <div className="stat-card purple">
                    <div className="stat-card-top">
                        <div className="stat-icon purple">
                            <Fuel size={22} />
                        </div>
                    </div>
                    <div className="stat-value">0</div>
                    <div className="stat-label">{t('dashboard.ethGasSponsored')}</div>
                </div>

                <div className="stat-card cyan">
                    <div className="stat-card-top">
                        <div className="stat-icon cyan">
                            <Zap size={22} />
                        </div>
                    </div>
                    <div className="stat-value">0</div>
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
                    <div className="card-body" style={{ padding: '8px 12px' }}>
                        <div className="empty-state">
                            <Inbox size={40} />
                            <div className="empty-state-title">{t('dashboard.noActivity')}</div>
                            <div className="empty-state-desc">{t('dashboard.noActivityDesc')}</div>
                        </div>
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
                                <span className="badge badge-pending">Type 0x04</span>
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
        </div>
    );
}
