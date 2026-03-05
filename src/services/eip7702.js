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
import { RPC_URLS } from '../config';

const CHAIN_MAP = {
    1: mainnet,
    11155111: sepolia,
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
    const publicClient = getPublicClient(chainId);
    const walletClient = getWalletClient(chainId);

    // 1. Sign an authorization pointing to the zero address
    const authToZero = await signAuthorization({
        contractAddress: '0x0000000000000000000000000000000000000000',
        account,
        chainId,
    });

    // 2. Broadcast a transaction applying this zero-address authorization to clear the code
    const hash = await walletClient.sendTransaction({
        account,
        to: account,
        value: 0n,
        authorizationList: [authToZero],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
        throw new Error('Revocation transaction reverted');
    }

    return { hash, receipt, authorization: authToZero };
}

// ==========================================
// 4. Gas Sponsorship (Async Intent Flow)
// ==========================================

// Minimal ABI for the sponsoredExecute function on the EIP-7702 Auto Forwarder
export const EIP7702_AUTO_FORWARDER_ABI = [
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

export async function executeSponsoredIntent(sponseeAddress, to, value, data, signature, sponsorAddress, chainId = 1, fallbackContract = null) {
    const publicClient = getPublicClient(chainId);
    const walletClient = getWalletClient(chainId);

    let weiValue;
    try {
        weiValue = value === '0' || !value ? 0n : parseEther(value.toString());
    } catch {
        weiValue = 0n;
    }

    // Prepare tx data to call `sponsoredExecute`
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

    // Determine target. Pre-Pectra MetaMask blocks sending data to an EOA.
    // If a fallbackContract is provided, we route through that actual deployed contract for demo purposes.
    const executionTarget = fallbackContract || sponseeAddress;

    const hash = await walletClient.sendTransaction({
        account: sponsorAddress,
        to: executionTarget,
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

// ==========================================
// 5. Real EIP-7702 Delegation (Private Key)
// ==========================================

import { privateKeyToAccount } from 'viem/accounts';

/**
 * Perform a real EIP-7702 delegation + initialize using a private key.
 * This bypasses MetaMask and sends a type 0x04 transaction directly via RPC.
 *
 * @param {Object} params
 * @param {string} params.privateKey — Private key (hex, with 0x prefix)
 * @param {string} params.contractAddress — Deployed delegate contract address
 * @param {string} params.forwardTarget — ETH forwarding target address
 * @param {string} params.gasSponsor — Gas sponsor address (optional)
 * @param {boolean} params.autoForward — Enable auto-forwarding (default: true)
 * @param {number} params.chainId — Chain ID (default: 11155111 Sepolia)
 * @param {function} params.onStatus — Status callback for UI updates
 * @returns {Object} { hash, receipt, account }
 */
export async function delegateWithPrivateKey({
    privateKey,
    contractAddress,
    forwardTarget,
    gasSponsor = '0x0000000000000000000000000000000000000000',
    autoForward = true,
    chainId = 11155111,
    sponsorPrivateKey = null,
    onStatus = () => { },
}) {
    if (!privateKey || !contractAddress || !forwardTarget) {
        throw new Error('缺少必填参数: privateKey, contractAddress, forwardTarget');
    }

    // Validate private key format
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
        throw new Error('私钥格式无效。需要 0x 开头的 64 位十六进制字符串。');
    }

    if (sponsorPrivateKey && !/^0x[0-9a-fA-F]{64}$/.test(sponsorPrivateKey)) {
        throw new Error('赞助商私钥格式无效。需要 0x 开头的 64 位十六进制字符串。');
    }

    const chain = CHAIN_MAP[chainId];
    if (!chain) throw new Error(`不支持的链 ID: ${chainId}`);

    const rpcUrl = RPC_URLS[chainId];
    const account = privateKeyToAccount(privateKey);

    onStatus('creating_clients');

    // The user's wallet client — used to sign authorization
    const userWalletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
    });

    // Determine who sends the transaction (pays gas)
    let txSenderClient;
    let txSenderAddress;

    if (sponsorPrivateKey) {
        const sponsorAccount = privateKeyToAccount(sponsorPrivateKey);
        txSenderClient = createWalletClient({
            account: sponsorAccount,
            chain,
            transport: http(rpcUrl),
        });
        txSenderAddress = sponsorAccount.address;
    } else {
        txSenderClient = userWalletClient;
        txSenderAddress = account.address;
    }

    const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
    });

    // Check balance of the gas payer
    onStatus('checking_balance');
    const balance = await publicClient.getBalance({ address: txSenderAddress });
    if (balance === 0n) {
        const who = sponsorPrivateKey ? '赞助商钱包' : 'EOA';
        throw new Error(`${who} 没有 ETH。请先获取 ${chain.name} 测试网 ETH。`);
    }

    // Sign the EIP-7702 authorization with the USER's key
    onStatus('signing_authorization');
    const authorization = await userWalletClient.signAuthorization({
        contractAddress,
        executor: sponsorPrivateKey ? 'self' : 'self',
    });

    // Encode initialize() calldata
    const FORWARDER_ABI = [{
        name: 'initialize', type: 'function', stateMutability: 'nonpayable',
        inputs: [
            { name: '_forwardTarget', type: 'address' },
            { name: '_gasSponsor', type: 'address' },
            { name: '_autoForward', type: 'bool' },
        ],
        outputs: [],
    }];

    const initData = encodeFunctionData({
        abi: FORWARDER_ABI,
        functionName: 'initialize',
        args: [forwardTarget, gasSponsor, autoForward],
    });

    // Send type 0x04 transaction — gas paid by txSenderClient
    onStatus('sending_transaction');
    const hash = await txSenderClient.sendTransaction({
        authorizationList: [authorization],
        data: initData,
        to: account.address, // Target is always the user's EOA
    });

    // Wait for confirmation
    onStatus('waiting_confirmation');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') {
        throw new Error('交易在链上回滚。');
    }

    // Verify on-chain config
    let config = null;
    try {
        const CONFIG_ABI = [{
            name: 'getConfig', type: 'function', stateMutability: 'view',
            inputs: [],
            outputs: [
                { name: '_forwardTarget', type: 'address' },
                { name: '_gasSponsor', type: 'address' },
                { name: '_autoForwardEnabled', type: 'bool' },
                { name: '_initialized', type: 'bool' },
            ],
        }];
        const result = await publicClient.readContract({
            address: account.address,
            abi: CONFIG_ABI,
            functionName: 'getConfig',
        });
        config = {
            forwardTarget: result[0],
            gasSponsor: result[1],
            autoForwardEnabled: result[2],
            initialized: result[3],
        };
    } catch {
        // Config verification may fail briefly after tx
    }

    return {
        hash,
        receipt,
        account: account.address,
        balance: formatEther(balance),
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        config,
        authorization,
    };
}
