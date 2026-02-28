/**
 * EIP-7702 Protocol Service
 *
 * Provides functions for:
 * - Signing EIP-7702 authorizations (delegate an EOA to a smart contract)
 * - Sending delegated transfers
 * - Gas sponsorship (a sponsor pays gas on behalf of the user)
 * - Revoking authorizations
 *
 * Compatible with MetaMask JSON-RPC accounts.
 * Uses raw ethereum provider methods since viem's signAuthorization
 * does NOT support JSON-RPC wallets.
 */

import {
    createPublicClient,
    createWalletClient,
    custom,
    parseEther,
    formatEther,
    encodeFunctionData,
    http,
    toHex,
    keccak256,
    encodeAbiParameters,
    parseAbiParameters,
} from 'viem';
import { mainnet, sepolia } from 'viem/chains';

const CHAIN_MAP = {
    1: mainnet,
    11155111: sepolia,
};

// Ankr RPC endpoints for reliable public reads
const RPC_URLS = {
    1: 'https://rpc.ankr.com/eth/2012b763b06d70a6f8957933b229023d703ccab6849fb3a0201ecfc92d04aac5',
    11155111: 'https://rpc.ankr.com/eth_sepolia/2012b763b06d70a6f8957933b229023d703ccab6849fb3a0201ecfc92d04aac5',
};

/**
 * Get a viem public client for reading on-chain data
 */
export function getPublicClient(chainId = 1) {
    const chain = CHAIN_MAP[chainId] || mainnet;
    const rpcUrl = RPC_URLS[chainId];
    return createPublicClient({
        chain,
        transport: rpcUrl ? http(rpcUrl) : http(),
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
 * Sign an EIP-7702 authorization using MetaMask's eth_signTypedData_v4.
 *
 * Since viem's signAuthorization does NOT support JSON-RPC accounts (MetaMask),
 * we construct the EIP-7702 authorization tuple and sign it via EIP-712 typed data.
 *
 * EIP-7702 Authorization format:
 *   MAGIC || rlp([chain_id, address, nonce])
 * where MAGIC = 0x05
 *
 * @param {Object} params
 * @param {string} params.contractAddress - Address of the delegate contract
 * @param {string} params.account - The EOA address signing the authorization
 * @param {number} params.chainId - Target chain ID
 * @returns {Object} The signed authorization object
 */
export async function signAuthorization({ contractAddress, account, chainId = 1 }) {
    if (!window.ethereum) throw new Error('No Ethereum wallet detected');

    const publicClient = getPublicClient(chainId);

    // Get the current nonce for the account
    const nonce = await publicClient.getTransactionCount({ address: account });

    // EIP-7702 uses EIP-712 structured signing
    // The authorization message is signed as typed data
    const typedData = {
        types: {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
            ],
            Authorization: [
                { name: 'chainId', type: 'uint256' },
                { name: 'codeAddress', type: 'address' },
                { name: 'nonce', type: 'uint256' },
            ],
        },
        primaryType: 'Authorization',
        domain: {
            name: 'EIP-7702 Authorization',
            version: '1',
            chainId: toHex(chainId),
        },
        message: {
            chainId: toHex(chainId),
            codeAddress: contractAddress,
            nonce: toHex(nonce),
        },
    };

    // Sign via MetaMask's eth_signTypedData_v4
    const signature = await window.ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [account, JSON.stringify(typedData)],
    });

    // Parse r, s, v from signature
    const r = '0x' + signature.slice(2, 66);
    const s = '0x' + signature.slice(66, 130);
    const v = parseInt(signature.slice(130, 132), 16);

    return {
        chainId,
        codeAddress: contractAddress,
        nonce,
        r,
        s,
        v,
        signer: account,
    };
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
 * @returns {Object} The revocation authorization object
 */
export async function revokeAuthorization({ account, chainId = 1 }) {
    // Sign an authorization pointing to the zero address to revoke
    const authorization = await signAuthorization({
        contractAddress: '0x0000000000000000000000000000000000000000',
        account,
        chainId,
    });

    return authorization;
}

// ==========================================
// 4. Gas Sponsorship (Async Intent Flow)
// ==========================================

// Minimal ABI for the sponsoredExecute function on the EIP-7702 Auto Forwarder
const EIP7702_AUTO_FORWARDER_ABI = [
    {
        inputs: [
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'value', type: 'uint256' },
            { internalType: 'bytes', name: 'data', type: 'bytes' },
            { internalType: 'bytes', name: 'signature', type: 'bytes' },
        ],
        name: 'sponsoredExecute',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
];

export function encodeGasSponsorshipIntent(chainId, sponseeAddress, to, value, data, nonce) {
    // Defines the EIP-712 Typed Data that the Sponsee will sign to express their intent
    // Omitted verifyingContract due to MetaMask pre-pectra limitation (cannot use internal account as contract)
    const domain = {
        name: 'EIP7702AutoForwarder',
        version: '1',
        chainId: Number(chainId)
    };

    const types = {
        SponsoredCall: [
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' },
            { name: 'nonce', type: 'uint256' },
        ],
    };

    // value needs to be safely handled as string/bigint based on input
    let weiValue;
    try {
        weiValue = value === '0' || !value ? 0n : parseEther(value.toString());
    } catch {
        weiValue = 0n;
    }

    const message = {
        to: to,
        value: weiValue.toString(), // For metamask typed data signing, string is safer
        data: data || '0x',
        nonce: nonce.toString(),
    };

    return {
        domain,
        types,
        primaryType: 'SponsoredCall',
        message,
    };
}

export async function executeSponsoredIntent(sponseeAddress, to, value, data, signature, sponsorAddress, chainId = 1) {
    const publicClient = getPublicClient(chainId);
    const walletClient = getWalletClient(chainId);

    let weiValue;
    try {
        weiValue = value === '0' || !value ? 0n : parseEther(value.toString());
    } catch {
        weiValue = 0n;
    }

    // Prepare tx data to call `sponsoredExecute` on the sponsee's delegated code
    const txData = encodeFunctionData({
        abi: EIP7702_AUTO_FORWARDER_ABI,
        functionName: 'sponsoredExecute',
        args: [
            to,
            weiValue,
            data || '0x',
            signature
        ]
    });

    // Sponsor pays the gas and sends the tx TO the sponsee's address
    // (since sponsee's logic is powered by 7702)
    const hash = await walletClient.sendTransaction({
        account: sponsorAddress,
        to: sponseeAddress,
        data: txData,
        value: 0n, // Sponsor is just paying gas, not necessarily sending ETH along (unless they want to)
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
        throw new Error('Transaction reverted on-chain during sponsor execution');
    }

    return { hash, receipt };
}

export { parseEther, formatEther };
