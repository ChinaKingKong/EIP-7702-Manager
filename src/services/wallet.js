/**
 * Wallet Connection & Management Service
 * Handles MetaMask connection, account state, and chain management.
 */

export const SUPPORTED_CHAINS = {
    1: { name: 'Ethereum Mainnet', symbol: 'ETH', explorer: 'https://etherscan.io' },
    11155111: { name: 'Sepolia Testnet', symbol: 'ETH', explorer: 'https://sepolia.etherscan.io' },
    17000: { name: 'Holesky Testnet', symbol: 'ETH', explorer: 'https://holesky.etherscan.io' },
};

/**
 * Check if MetaMask (or compatible provider) is available
 */
export function isWalletAvailable() {
    return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
}

/**
 * Connect to MetaMask wallet
 * @returns {{ address: string, chainId: number }}
 */
export async function connectWallet() {
    if (!isWalletAvailable()) {
        throw new Error('No Ethereum wallet detected. Please install MetaMask.');
    }

    const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
    });

    if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock your wallet.');
    }

    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
    const chainId = parseInt(chainIdHex, 16);

    return {
        address: accounts[0],
        chainId,
    };
}

/**
 * Get ETH balance for an address
 * @param {string} address
 * @returns {string} balance in ETH
 */
export async function getBalance(address) {
    if (!isWalletAvailable()) return '0';

    const balanceHex = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
    });

    const balanceWei = BigInt(balanceHex);
    const balanceEth = Number(balanceWei) / 1e18;
    return balanceEth.toFixed(4);
}

/**
 * Get current chain ID
 * @returns {number}
 */
export async function getChainId() {
    if (!isWalletAvailable()) return 0;
    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
    return parseInt(chainIdHex, 16);
}

/**
 * Get chain info from chain ID
 * @param {number} chainId
 */
export function getChainInfo(chainId) {
    return SUPPORTED_CHAINS[chainId] || { name: `Chain #${chainId}`, symbol: 'ETH', explorer: '' };
}

/**
 * Truncate an Ethereum address for display
 * @param {string} address
 * @returns {string}
 */
export function truncateAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Register event listeners for wallet changes
 */
export function onAccountsChanged(callback) {
    if (!isWalletAvailable()) return () => { };
    window.ethereum.on('accountsChanged', callback);
    return () => window.ethereum.removeListener('accountsChanged', callback);
}

export function onChainChanged(callback) {
    if (!isWalletAvailable()) return () => { };
    const handler = (chainIdHex) => callback(parseInt(chainIdHex, 16));
    window.ethereum.on('chainChanged', handler);
    return () => window.ethereum.removeListener('chainChanged', handler);
}
