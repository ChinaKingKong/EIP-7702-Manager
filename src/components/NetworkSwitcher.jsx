import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { useI18n } from '../context/I18nContext';

const NETWORKS = [
    { chainId: 1, hexId: '0x1', name: 'Ethereum', shortName: 'ETH', color: '#627eea' },
    { chainId: 11155111, hexId: '0xaa36a7', name: 'Sepolia', shortName: 'Sepolia', color: '#f6c343', rpcUrl: 'https://rpc.sepolia.org', explorer: 'https://sepolia.etherscan.io' },
    { chainId: 17000, hexId: '0x4268', name: 'Holesky', shortName: 'Holesky', color: '#ffb3b3', rpcUrl: 'https://rpc.holesky.ethpandaops.io', explorer: 'https://holesky.etherscan.io' },
];

export default function NetworkSwitcher() {
    const { isConnected, chainId } = useWallet();
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [switching, setSwitching] = useState(false);

    const currentNetwork = NETWORKS.find((n) => n.chainId === chainId);

    const handleSwitch = async (net) => {
        if (!window.ethereum || net.chainId === chainId) {
            setOpen(false);
            return;
        }
        setSwitching(true);
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: net.hexId }],
            });
        } catch (err) {
            // 4902 = chain not added to wallet
            if (err.code === 4902 && net.rpcUrl) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: net.hexId,
                            chainName: net.name,
                            rpcUrls: [net.rpcUrl],
                            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                            blockExplorerUrls: [net.explorer]
                        }],
                    });
                } catch (addError) {
                    console.error('Failed to add network:', addError);
                }
            } else {
                console.error('Switch chain error:', err);
            }
        } finally {
            setSwitching(false);
            setOpen(false);
        }
    };

    return (
        <div className="network-switcher" style={{ position: 'relative' }}>
            <button
                className="btn btn-glass"
                onClick={() => setOpen(!open)}
                disabled={!isConnected || switching}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isConnected ? 'pointer' : 'default',
                    opacity: isConnected ? 1 : 0.5,
                }}
            >
                <div
                    style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: currentNetwork ? currentNetwork.color : '#666',
                    }}
                />
                <span>{currentNetwork ? currentNetwork.shortName : t('network.unknown')}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.6 }}>
                    <path d="M2 4 L5 7 L8 4" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </button>

            {open && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                        onClick={() => setOpen(false)}
                    />
                    <div
                        className="network-dropdown"
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            right: 0,
                            minWidth: '180px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '12px',
                            padding: '6px',
                            zIndex: 100,
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        }}
                    >
                        <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>
                            {t('network.switchNetwork')}
                        </div>
                        {NETWORKS.map((net) => (
                            <button
                                key={net.chainId}
                                onClick={() => handleSwitch(net)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '10px',
                                    background: net.chainId === chainId ? 'var(--bg-glass)' : 'transparent',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    color: 'var(--text-primary)',
                                    fontSize: '13px',
                                    fontWeight: net.chainId === chainId ? 600 : 400,
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => { if (net.chainId !== chainId) e.target.style.background = 'var(--bg-glass)'; }}
                                onMouseLeave={(e) => { if (net.chainId !== chainId) e.target.style.background = 'transparent'; }}
                            >
                                <div
                                    style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        background: net.color,
                                        flexShrink: 0,
                                    }}
                                />
                                <span>{net.name}</span>
                                {net.chainId === chainId && (
                                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--accent-green)' }}>✓</span>
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
