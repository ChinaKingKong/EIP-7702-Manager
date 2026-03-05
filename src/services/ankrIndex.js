import { RPC_URLS } from '../config';

/**
 * Fetches the ERC20 token balances for a given wallet address using Ankr Advanced API
 * @param {string} walletAddress The EOA address
 * @param {number} chainId The current network chain ID
 * @returns {Promise<Array>} List of token objects
 */
export async function getAccountTokens(walletAddress, chainId = 11155111) {
    const blockchainMap = {
        1: 'eth',
        11155111: 'eth_sepolia',
        17000: 'eth_holesky'
    };

    const blockchain = blockchainMap[chainId];
    if (!blockchain) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    // Extract API key from RPC_URLS or use fallback
    const defaultRpc = RPC_URLS[chainId] || RPC_URLS[11155111];
    let apiKey = 'ea7e5b99bbd88a55cfd8d3973165ef9bf11ac1149985999f88efdcd8f7bfe6de';
    if (defaultRpc && defaultRpc.includes('ankr.com')) {
        const parts = defaultRpc.split('/');
        apiKey = parts[parts.length - 1]; // e.g. ea7e...
    }
    const apiUrl = `https://rpc.ankr.com/multichain/${apiKey}/`;

    console.log(`[TokenScanner] Starting advanced scan for ${walletAddress} on ${blockchain}`);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'ankr_getAccountBalance',
                params: {
                    blockchain: blockchain,
                    walletAddress: walletAddress,
                    onlyWhitelisted: false
                },
                id: 1
            })
        });

        if (!response.ok) {
            throw new Error(`Ankr API HTTP Error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || 'Unknown RPC Error');
        }

        const assets = data.result?.assets || [];

        // Filter out native ETH and only return ERC20 tokens
        const erc20Assets = assets.filter(asset => asset.tokenType === 'ERC20');

        console.log(`[TokenScanner] Scan complete. Found ${erc20Assets.length} ERC20 tokens with balance.`);

        return erc20Assets.map(asset => ({
            contractAddress: asset.contractAddress,
            tokenName: asset.tokenName || 'Unknown',
            tokenSymbol: asset.tokenSymbol || '???',
            balance: asset.balance,
            tokenDecimals: asset.tokenDecimals || 18,
            thumbnailUrl: asset.thumbnail || null
        }));
    } catch (error) {
        console.error('[TokenScanner] Error during advanced scan:', error);
        throw new Error(`代币扫描失败: ${error.message || '未知错误'}。请检查网络连接或 API 配额。`);
    }
}
