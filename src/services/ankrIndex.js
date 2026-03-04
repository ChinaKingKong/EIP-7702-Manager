import { createPublicClient, http, parseAbi } from 'viem';
import { mainnet, sepolia, holesky } from 'viem/chains';
import { RPC_URLS } from '../config';

// ERC20 minified ABI for balance and metadata
const erc20Abi = parseAbi([
    'function balanceOf(address owner) view returns (uint256)',
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)'
]);

const chains = {
    1: mainnet,
    11155111: sepolia,
    17000: holesky
};

// Top/Common tokens for each network to blindly scan if APIs fail
const scanList = {
    // Sepolia Testnet popular FAUCET tokens
    11155111: [
        '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC Sepolia
        '0x779877A7B0D9E8603169DdbD7836e478b4624789', // LINK Sepolia
        '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', // WETH Sepolia
        '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI Sepolia
        '0x09c85E7C20EEecf2de5f5DC164a27FEE8cfB7da5', // AAVE Sepolia
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH (Sometimes mistakenly used on testnets)
    ],
    // Mainnet
    1: [
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eb48', // USDC
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        '0x514910771AF9Ca656af840dff83E8264EcF986CA', // LINK
        '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
    ],
    // Holesky
    17000: [
        '0x94373a4919B3240D86eA41593D5eBa789FEF3848', // WETH Holesky
    ]
};

/**
 * Fetches the ERC20 token balances for a given wallet address using native Viem Multicall
 * @param {string} walletAddress The EOA address
 * @param {number} chainId The current network chain ID
 * @returns {Promise<Array>} List of token objects
 */
export async function getAccountTokens(walletAddress, chainId = 11155111) {
    const chain = chains[chainId] || sepolia;
    const rpcUrl = RPC_URLS[chainId] || RPC_URLS[11155111];

    console.log(`[TokenScanner] Starting scan for ${walletAddress} on chain ${chainId} using RPC: ${rpcUrl}`);

    const client = createPublicClient({
        chain,
        transport: http(rpcUrl),
        batch: { multicall: true }
    });

    const tokensToScan = scanList[chainId] || [];
    if (tokensToScan.length === 0) {
        console.warn(`[TokenScanner] No tokens in scan list for chain ${chainId}`);
        return [];
    }

    try {
        // Create multicall batches for balance of
        const balanceCalls = tokensToScan.map(address => ({
            address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [walletAddress]
        }));

        console.log(`[TokenScanner] Batching ${balanceCalls.length} balance checks...`);
        const results = await client.multicall({
            contracts: balanceCalls,
        });

        const activeTokens = [];

        // Find which ones actually have a balance
        for (let i = 0; i < results.length; i++) {
            if (results[i].status === 'success' && results[i].result > 0n) {
                const tokenAddress = tokensToScan[i];
                console.log(`[TokenScanner] Found balance for ${tokenAddress}: ${results[i].result.toString()}`);

                try {
                    // Optimized: Fetch meta in one multicall
                    const [symbolResult, nameResult, decimalsResult] = await client.multicall({
                        contracts: [
                            { address: tokenAddress, abi: erc20Abi, functionName: 'symbol' },
                            { address: tokenAddress, abi: erc20Abi, functionName: 'name' },
                            { address: tokenAddress, abi: erc20Abi, functionName: 'decimals' }
                        ]
                    });

                    const decimals = decimalsResult.status === 'success' ? Number(decimalsResult.result) : 18;
                    const balanceFormatted = Number(results[i].result) / Math.pow(10, decimals);

                    activeTokens.push({
                        contractAddress: tokenAddress,
                        tokenName: nameResult.status === 'success' ? nameResult.result : 'Unknown',
                        tokenSymbol: symbolResult.status === 'success' ? symbolResult.result : '???',
                        balance: balanceFormatted.toString(),
                        tokenDecimals: decimals,
                        thumbnailUrl: null
                    });
                } catch (metaErr) {
                    console.warn(`[TokenScanner] Metadata fetch failed for ${tokenAddress}`, metaErr);
                    activeTokens.push({
                        contractAddress: tokenAddress,
                        tokenName: 'ERC20 Token',
                        tokenSymbol: 'TKN',
                        balance: (Number(results[i].result) / 10 ** 18).toString(),
                        tokenDecimals: 18,
                        thumbnailUrl: null
                    });
                }
            }
        }

        console.log(`[TokenScanner] Scan complete. Found ${activeTokens.length} tokens with balance.`);
        return activeTokens;
    } catch (error) {
        console.error('[TokenScanner] Error during scan:', error);
        // Fallback or more descriptive error message to help the user debug
        throw new Error(`代币扫描失败: ${error.message || '未知 RPC 错误'}。请检查您的网络连接或 RPC 配置。`);
    }
}
