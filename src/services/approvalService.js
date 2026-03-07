import { getPublicClient, executeSponsoredIntent, encodeGasSponsorshipIntent, signAuthorization } from './eip7702';
import { encodeFunctionData, parseAbi, decodeEventLog, createWalletClient, custom, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { RPC_URLS, DEFAULT_CONTRACT_ADDRESS } from '../config';

const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
const APPROVAL_FOR_ALL_TOPIC = '0x17307eab39ab245c117867d9a024750e40ca9dcf5796a60bc93876e93246a48f';

const ERC20_ABI = parseAbi([
    'function approve(address spender, uint256 amount) public returns (bool)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function symbol() public view returns (string)',
    'function decimals() public view returns (uint8)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)'
]);

const ERC721_ABI = parseAbi([
    'function setApprovalForAll(address operator, bool approved) public',
    'function isApprovedForAll(address owner, address operator) public view returns (bool)',
    'function symbol() public view returns (string)',
    'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)'
]);

/**
 * Fetch historical approvals for a wallet using Ankr Advanced API
 */
export async function getAccountApprovals(walletAddress, chainId = 11155111) {
    console.log(`[ApprovalService] getAccountApprovals for ${walletAddress} on chain ${chainId}`);
    const publicClient = getPublicClient(chainId);
    const approvals = [];
    const seen = new Set();

    const fetchAnkrLogs = async () => {
        const blockchainMap = {
            1: 'eth',
            11155111: 'eth_sepolia',
            17000: 'eth_holesky'
        };

        const blockchain = blockchainMap[chainId];
        if (!blockchain) {
            console.warn(`[ApprovalService] Unmapped chainId for Ankr: ${chainId}`);
            return [];
        }

        const defaultRpc = RPC_URLS[chainId] || RPC_URLS[11155111];
        // Use dedicated key or extract from RPC
        let apiKey = import.meta.env.VITE_ANKR_API_KEY || 'ea7e5b99bbd88a55cfd8d3973165ef9bf11ac1149985999f88efdcd8f7bfe6de';
        if (!import.meta.env.VITE_ANKR_API_KEY && defaultRpc && defaultRpc.includes('ankr.com')) {
            const parts = defaultRpc.split('/').filter(Boolean);
            apiKey = parts[parts.length - 1];
        }
        const apiUrl = `https://rpc.ankr.com/multichain/${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'ankr_getLogs',
                params: {
                    blockchain: blockchain,
                    topics: [
                        [APPROVAL_TOPIC, APPROVAL_FOR_ALL_TOPIC],
                        '0x' + walletAddress.toLowerCase().replace('0x', '').padStart(64, '0')
                    ],
                    fromBlock: '0x0',
                    toBlock: 'latest',
                    pageSize: 1000
                },
                id: 1
            })
        });

        const data = await response.json();
        return data.result?.logs || [];
    };

    const fetchViemLogs = async () => {
        try {
            // Get logs for the last 10000 blocks as a basic fallback
            // Note: fromBlock 0 might be too slow for some public RPCs, but we'll try 'earliest'
            const logs = await publicClient.getLogs({
                event: parseAbi([
                    'event Approval(address indexed owner, address indexed spender, uint256 value)',
                    'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)'
                ])[0], // This syntax might be tricky with multiple events, but we can do topics
                fromBlock: 'earliest'
            }).catch(() => []);
            
            // Or use low level topics
            const blockNumber = await publicClient.getBlockNumber();
            const fromBlock = BigInt(Math.max(0, Number(blockNumber) - 50000)); // Last 50k blocks for speed
            console.log(`[ApprovalService] Viem log fetching from ${fromBlock} to ${blockNumber}`);
            
            const approvalLogs = await publicClient.getLogs({
                topics: [
                    [APPROVAL_TOPIC, APPROVAL_FOR_ALL_TOPIC],
                    '0x' + walletAddress.toLowerCase().replace('0x', '').padStart(64, '0')
                ],
                fromBlock
            });
            return approvalLogs;
        } catch (e) {
            console.warn('Viem log fetching failed:', e);
            return [];
        }
    };

    try {
        let logs = await fetchAnkrLogs().catch(e => {
            console.error('Ankr fetch failed:', e);
            return [];
        });

        if (logs.length === 0) {
            console.log('Ankr returned no logs, trying Viem fallback...');
            logs = await fetchViemLogs();
        }

        // Sort logs descending by block number if possible to process newest first
        logs.sort((a, b) => {
            const blockA = BigInt(a.blockNumber || 0);
            const blockB = BigInt(b.blockNumber || 0);
            if (blockA > blockB) return -1;
            if (blockA < blockB) return 1;
            return 0;
        });

        console.log(`[ApprovalService] Processing ${logs.length} logs for ${walletAddress}`);

        for (const log of logs) {
            const topic0 = log.topics[0].toLowerCase();
            const isErc20 = topic0 === APPROVAL_TOPIC && log.topics.length === 3;
            const isNft = topic0 === APPROVAL_FOR_ALL_TOPIC && log.topics.length === 3;
            const isNftSingle = topic0 === APPROVAL_TOPIC && log.topics.length === 4;

            if (!isErc20 && !isNft && !isNftSingle) continue;

            const tokenAddress = log.address;
            const spender = '0x' + log.topics[2].slice(26);

            const key = `${tokenAddress.toLowerCase()}-${spender.toLowerCase()}-${topic0}`;
            if (seen.has(key)) continue;
            seen.add(key);

            try {
                // Verify current status
                let isStillActive = false;
                let allowance = '0';
                let symbol = 'Unknown';

                if (isErc20) {
                    // Pre-filtering: If log data is 0, it's a revocation log. 
                    // Since we sort descending, if the first log we see for a pair is a revocation, 
                    // we can skip the on-chain scan entirely as it's highly likely to be 0.
                    const logValue = BigInt(log.data || 0);
                    if (logValue === 0n) {
                        // Mark as seen so older approval logs are skipped, but don't add to list
                        continue;
                    }

                    const currentAllowance = await publicClient.readContract({
                        address: tokenAddress,
                        abi: ERC20_ABI,
                        functionName: 'allowance',
                        args: [walletAddress, spender]
                    });
                    
                    if (currentAllowance > 0n) {
                        isStillActive = true;
                        allowance = currentAllowance.toString();
                        symbol = await publicClient.readContract({
                            address: tokenAddress,
                            abi: ERC20_ABI,
                            functionName: 'symbol'
                        }).catch(() => '???');
                    }
                } else if (isNft || isNftSingle) {
                    // Pre-filtering for NFT: if log data is explicitly "false" (revocation)
                    // For ApprovalForAll, data is the boolean "approved"
                    if (isNft && log.data === '0x0000000000000000000000000000000000000000000000000000000000000000') {
                        continue;
                    }

                    const isApproved = isNft ? 
                        await publicClient.readContract({
                            address: tokenAddress,
                            abi: ERC721_ABI,
                            functionName: 'isApprovedForAll',
                            args: [walletAddress, spender]
                        }) : 
                        await publicClient.readContract({
                            address: tokenAddress,
                            abi: parseAbi(['function getApproved(uint256 tokenId) view returns (address)']),
                            functionName: 'getApproved',
                            args: [BigInt(log.topics[3])]
                        }).then(approved => approved.toLowerCase() === spender.toLowerCase()).catch(() => false);
                    
                    if (isApproved) {
                        isStillActive = true;
                        allowance = isNft ? 'ALL' : `ID: ${BigInt(log.topics[3]).toString()}`;
                        symbol = await publicClient.readContract({
                            address: tokenAddress,
                            abi: ERC721_ABI,
                            functionName: 'symbol'
                        }).catch(() => 'NFT');
                    }
                }

                if (isStillActive) {
                    approvals.push({
                        tokenAddress,
                        spender,
                        allowance,
                        symbol,
                        type: isErc20 ? 'ERC20' : 'NFT',
                        timestamp: log.timestamp ? (parseInt(log.timestamp.toString(), 16) * 1000) : Date.now()
                    });
                }
            } catch (e) {
                // Silent fail for individual tokens
            }
        }

        return approvals
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 30);
    } catch (error) {
        console.error('[ApprovalService] Error fetching approvals:', error);
        throw error;
    }
}

/**
 * Revoke a token approval with optional gas sponsorship
 */
export async function revokeTokenApproval({
    walletAddress,
    tokenAddress,
    spender,
    type,
    chainId,
    sponsorPrivateKey = null,
    walletPrivateKey = null
}) {
    const publicClient = getPublicClient(chainId);
    
    // Revocation data
    let callData;
    if (type === 'ERC20') {
        callData = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [spender, 0n]
        });
    } else {
        callData = encodeFunctionData({
            abi: ERC721_ABI,
            functionName: 'setApprovalForAll',
            args: [spender, false]
        });
    }

    if (sponsorPrivateKey) {
        console.log(`[ApprovalService] Starting sponsored revocation for ${tokenAddress} from ${walletAddress}`);
        
        // Safety check: is the account delegated?
        const code = await publicClient.getBytecode({ address: walletAddress });
        const hasCode = code && code !== '0x';
        console.log(`[ApprovalService] Bytecode check for ${walletAddress} on chain ${chainId}: ${hasCode ? code.length : 0} bytes`);
        
        let auth = null;
        let nonce;

        if (!hasCode) {
            console.log(`[ApprovalService] Account ${walletAddress} is a standard EOA. Preparing bundled EIP-7702 authorization.`);
            
            // For standard EOAs, we sign an EIP-7702 Authorization and the sponsor sends the tx.
            // We'll point to the default contract address.
            auth = await signAuthorization({
                contractAddress: DEFAULT_CONTRACT_ADDRESS,
                account: walletAddress,
                chainId,
                privateKey: walletPrivateKey
            });

            // For non-delegated EOAs, the NONCE for the Intent signature should start from 0 
            // because the contract isn't deployed yet and getNextNonce() doesn't exist.
            // Actually, EIP7702AutoForwarder starts it at 0 on init.
            nonce = 0n;
        } else {
            // Already delegated accounts use their on-chain nonce
            try {
                nonce = await publicClient.readContract({
                    address: walletAddress,
                    abi: parseAbi(['function getNextNonce() view returns (uint256)']),
                    functionName: 'getNextNonce'
                });
            } catch (e) {
                console.warn('[ApprovalService] Failed to fetch next nonce, falling back to 0');
                nonce = 0n;
            }
        }

        console.log(`[ApprovalService] Using nonce for intent: ${nonce}`);

        // Sign the Intent (EIP-712)
        const intent = encodeGasSponsorshipIntent(chainId, walletAddress, tokenAddress, '0', callData, nonce);
        
        let signature;
        if (walletPrivateKey) {
            console.log('[ApprovalService] Signing intent locally with wallet private key');
            if (!walletPrivateKey.startsWith('0x')) walletPrivateKey = `0x${walletPrivateKey}`;
            const account = privateKeyToAccount(walletPrivateKey);
            const signerClient = createWalletClient({
                account,
                chain: publicClient.chain,
                transport: http()
            });
            signature = await signerClient.signTypedData(intent);
        } else {
            // Sign via MetaMask (sponsee)
            const jsonSafeIntent = {
                ...intent,
                message: {
                    ...intent.message,
                    value: intent.message.value.toString(),
                    nonce: intent.message.nonce.toString()
                }
            };
            signature = await window.ethereum.request({
                method: 'eth_signTypedData_v4',
                params: [walletAddress, JSON.stringify(jsonSafeIntent)]
            });
        }

        // Execute via Sponsor
        return executeSponsoredIntent(
            walletAddress,
            tokenAddress,
            '0',
            callData,
            signature,
            null, // sponsorAddress will be derived from sponsorPrivateKey
            chainId,
            null,
            sponsorPrivateKey,
            auth // Pass the 7702 auth if it's an EOA
        );
    } else {
        // Standard Revocation via connected wallet or private key (self-paid)
        let txSenderClient;
        if (walletPrivateKey) {
            if (!walletPrivateKey.startsWith('0x')) walletPrivateKey = `0x${walletPrivateKey}`;
            txSenderClient = createWalletClient({
                account: privateKeyToAccount(walletPrivateKey),
                chain: publicClient.chain,
                transport: http(RPC_URLS[chainId])
            });
        } else {
            txSenderClient = createWalletClient({
                chain: publicClient.chain,
                transport: custom(window.ethereum)
            });
        }
        
        const hash = await txSenderClient.sendTransaction({
            account: walletAddress,
            to: tokenAddress,
            data: callData
        });
        
        return { hash };
    }
}
