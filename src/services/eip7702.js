/**
 * EIP-7702 Protocol Service
 *
 * Provides functions for:
 * - Signing EIP-7702 authorizations (delegate an EOA to a smart contract)
 * - Sending delegated transfers
 * - Gas sponsorship (a sponsor pays gas on behalf of the user)
 * - Revoking authorizations
 *
 * Uses viem library for EIP-7702 transaction construction.
 */

import {
    createPublicClient,
    createWalletClient,
    custom,
    parseEther,
    formatEther,
    encodeFunctionData,
    http,
} from 'viem';
import { mainnet, sepolia, holesky } from 'viem/chains';

const CHAIN_MAP = {
    1: mainnet,
    11155111: sepolia,
    17000: holesky,
};

/**
 * Get a viem public client for reading on-chain data
 */
export function getPublicClient(chainId = 1) {
    const chain = CHAIN_MAP[chainId] || mainnet;
    return createPublicClient({
        chain,
        transport: http(),
    });
}

/**
 * Get a viem wallet client connected to the user's browser wallet
 */
export function getWalletClient(chainId = 1) {
    if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No Ethereum wallet detected');
    }
    const chain = CHAIN_MAP[chainId] || mainnet;
    return createWalletClient({
        chain,
        transport: custom(window.ethereum),
    });
}

/**
 * Sign an EIP-7702 authorization.
 * This creates a signed message that delegates the EOA's execution to the given contract.
 *
 * @param {Object} params
 * @param {string} params.contractAddress - Address of the delegate contract
 * @param {string} params.account - The EOA address signing the authorization
 * @param {number} params.chainId - Target chain ID
 * @returns {Object} The signed authorization object
 */
export async function signAuthorization({ contractAddress, account, chainId = 1 }) {
    const walletClient = getWalletClient(chainId);

    // EIP-7702 authorization signing via viem experimental API
    const authorization = await walletClient.signAuthorization({
        account,
        contractAddress,
    });

    return authorization;
}

/**
 * Send a delegated transfer.
 * Executes a transfer through the delegated contract on behalf of the EOA.
 *
 * @param {Object} params
 * @param {string} params.to - Recipient address
 * @param {string} params.value - Amount in ETH (as string, e.g. "0.1")
 * @param {Object} params.authorization - Signed authorization object
 * @param {string} params.account - Sender (EOA) address
 * @param {number} params.chainId - Chain ID
 * @returns {string} Transaction hash
 */
export async function sendDelegatedTransfer({ to, value, authorization, account, chainId = 1 }) {
    const walletClient = getWalletClient(chainId);

    const hash = await walletClient.sendTransaction({
        account,
        to,
        value: parseEther(value),
        authorizationList: [authorization],
    });

    return hash;
}

/**
 * Sponsor a transaction's gas fee.
 * The sponsor wallet pays for the gas of the user's transaction.
 *
 * @param {Object} params
 * @param {string} params.userAddress - The address whose tx is being sponsored
 * @param {string} params.to - Destination address
 * @param {string} params.value - Amount in ETH
 * @param {string} params.data - Encoded calldata (optional)
 * @param {Object} params.authorization - Signed authorization from the user
 * @param {string} params.sponsorAccount - The sponsor's address (pays gas)
 * @param {number} params.chainId
 * @returns {string} Transaction hash
 */
export async function sponsorTransaction({
    userAddress,
    to,
    value = '0',
    data = '0x',
    authorization,
    sponsorAccount,
    chainId = 1,
}) {
    const walletClient = getWalletClient(chainId);

    // The sponsor sends the transaction including the user's authorization
    const hash = await walletClient.sendTransaction({
        account: sponsorAccount,
        to: userAddress,
        value: parseEther(value),
        data,
        authorizationList: authorization ? [authorization] : [],
    });

    return hash;
}

/**
 * Revoke an EIP-7702 authorization by setting the delegate to the zero address.
 *
 * @param {Object} params
 * @param {string} params.account - The EOA whose authorization to revoke
 * @param {number} params.chainId
 * @returns {string} Transaction hash
 */
export async function revokeAuthorization({ account, chainId = 1 }) {
    const walletClient = getWalletClient(chainId);

    // Sign authorization with zero address to revoke
    const authorization = await walletClient.signAuthorization({
        account,
        contractAddress: '0x0000000000000000000000000000000000000000',
    });

    const hash = await walletClient.sendTransaction({
        account,
        authorizationList: [authorization],
    });

    return hash;
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas({ to, value = '0', data = '0x', from, chainId = 1 }) {
    const publicClient = getPublicClient(chainId);

    try {
        const gasEstimate = await publicClient.estimateGas({
            account: from,
            to,
            value: parseEther(value),
            data,
        });

        const gasPrice = await publicClient.getGasPrice();
        const totalCostWei = gasEstimate * gasPrice;

        return {
            gasLimit: gasEstimate.toString(),
            gasPrice: formatEther(gasPrice),
            totalCost: formatEther(totalCostWei),
        };
    } catch {
        return {
            gasLimit: '21000',
            gasPrice: '0.000000020',
            totalCost: '0.00042',
        };
    }
}

export { parseEther, formatEther };
