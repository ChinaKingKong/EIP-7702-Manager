import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Shield, Fuel, Rocket, Send } from 'lucide-react';
import WalletConnect from './WalletConnect';
import LanguageSwitcher from './LanguageSwitcher';
import NetworkSwitcher from './NetworkSwitcher';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';

export default function Layout() {
    const { isConnected, chainId } = useWallet();
    const { t } = useI18n();

    const NAV_ITEMS = [
        {
            section: t('nav.sectionMain'),
            items: [
                { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
                { to: '/deploy', icon: Rocket, label: t('nav.deployContract') },
                { to: '/authorization', icon: Shield, label: t('nav.authorization') },
                { to: '/auto-forward', icon: Send, label: t('nav.autoForwardConfig') },
                { to: '/nft-sweep', icon: Send, label: t('nav.nftSweep') },
                { to: '/gas-sponsorship', icon: Fuel, label: t('nav.gasSponsorship') },
            ],
        },
    ];

    const getChainName = () => {
        const chains = {
            1: t('common.mainnet'),
            11155111: t('common.sepolia'),
            17000: t('common.holesky')
        };
        return chains[chainId] || t('common.notConnected');
    };

    return (
        <div className="app-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <img src="/logo.png" alt="EIP-7702" className="sidebar-logo-img" />
                    <div className="sidebar-logo-text">
                        <h1>EIP-7702</h1>
                        <span>{t('nav.protocolDashboard')}</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {NAV_ITEMS.map((section) => (
                        <React.Fragment key={section.section}>
                            <div className="sidebar-section-label">{section.section}</div>
                            {section.items.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.to === '/'}
                                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                                >
                                    <item.icon className="nav-icon" size={20} />
                                    <span className="nav-text">{item.label}</span>
                                    {item.badge && <span className="nav-badge">{item.badge}</span>}
                                </NavLink>
                            ))}
                        </React.Fragment>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="network-status">
                        <div className={`network-dot ${isConnected ? '' : 'disconnected'}`} />
                        <div className="network-info">
                            <span className="network-name">{getChainName()}</span>
                            <span className="network-label">{isConnected ? t('common.connected') : t('common.disconnected')}</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <header className="content-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
                        <NetworkSwitcher />
                        <LanguageSwitcher />
                        <WalletConnect />
                    </div>
                </header>
                <div className="content-body">
                    <div className="page-enter">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}
