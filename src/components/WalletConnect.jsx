import React from 'react';
import { Wallet, LogOut, Loader2 } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';

export default function WalletConnect() {
    const { address, balance, isConnected, isConnecting, connect, disconnect, truncateAddress, chainInfo } = useWallet();
    const { t } = useI18n();

    if (isConnecting) {
        return (
            <button className="wallet-connect-btn" disabled>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                {t('common.connecting')}
            </button>
        );
    }

    if (isConnected && address) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="wallet-connect-btn connected">
                    <div className="wallet-dot" />
                    <span className="wallet-address">{truncateAddress()}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '10px', marginLeft: '2px' }}>
                        {balance} {chainInfo?.symbol || 'ETH'}
                    </span>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={disconnect}
                    title={t('common.disconnect')}
                    style={{ padding: '10px' }}
                >
                    <LogOut size={16} />
                </button>
            </div>
        );
    }

    return (
        <button className="wallet-connect-btn" onClick={connect}>
            <Wallet size={16} />
            {t('common.connectWallet')}
        </button>
    );
}
