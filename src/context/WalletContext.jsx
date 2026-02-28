import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    connectWallet as connectWalletService,
    getBalance,
    getChainInfo,
    truncateAddress,
    onAccountsChanged,
    onChainChanged,
    isWalletAvailable,
} from '../services/wallet';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
    const [wallet, setWallet] = useState({
        address: null,
        balance: '0',
        chainId: 0,
        chainInfo: null,
        isConnected: false,
        isConnecting: false,
        error: null,
    });

    const updateBalance = useCallback(async (address) => {
        if (!address) return;
        try {
            const balance = await getBalance(address);
            setWallet((prev) => ({ ...prev, balance }));
        } catch (e) {
            console.error('Failed to fetch balance:', e);
        }
    }, []);

    const connect = useCallback(async () => {
        setWallet((prev) => ({ ...prev, isConnecting: true, error: null }));
        try {
            const { address, chainId } = await connectWalletService();
            const balance = await getBalance(address);
            const chainInfo = getChainInfo(chainId);
            setWallet({
                address,
                balance,
                chainId,
                chainInfo,
                isConnected: true,
                isConnecting: false,
                error: null,
            });
        } catch (err) {
            setWallet((prev) => ({
                ...prev,
                isConnecting: false,
                error: err.message,
            }));
        }
    }, []);

    const disconnect = useCallback(() => {
        setWallet({
            address: null,
            balance: '0',
            chainId: 0,
            chainInfo: null,
            isConnected: false,
            isConnecting: false,
            error: null,
        });
    }, []);

    useEffect(() => {
        if (!isWalletAvailable()) return;

        const unsubAccounts = onAccountsChanged((accounts) => {
            if (accounts.length === 0) {
                disconnect();
            } else {
                const newAddr = accounts[0];
                setWallet((prev) => ({ ...prev, address: newAddr }));
                updateBalance(newAddr);
            }
        });

        const unsubChain = onChainChanged((chainId) => {
            const chainInfo = getChainInfo(chainId);
            setWallet((prev) => ({ ...prev, chainId, chainInfo }));
        });

        return () => {
            unsubAccounts();
            unsubChain();
        };
    }, [disconnect, updateBalance]);

    const value = {
        ...wallet,
        connect,
        disconnect,
        truncateAddress: () => truncateAddress(wallet.address),
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const ctx = useContext(WalletContext);
    if (!ctx) throw new Error('useWallet must be used within <WalletProvider>');
    return ctx;
}
