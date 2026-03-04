#!/usr/bin/env node
/**
 * EIP-7702 Delegate & Initialize Script
 *
 * This script performs the full EIP-7702 delegation flow:
 * 1. Signs an authorization pointing your EOA to the AutoForwarder contract
 * 2. Sends a type 0x04 transaction that:
 *    - Sets the EOA's code to the delegate contract
 *    - Calls initialize(forwardTarget, gasSponsor, autoForward)
 *
 * After this script runs, any ETH sent to the EOA will be
 * auto-forwarded to the forwardTarget address.
 *
 * Usage:
 *   node scripts/delegate.mjs
 *
 * Required env vars (in .env):
 *   PRIVATE_KEY       — EOA private key (hex, with 0x prefix)
 *   CONTRACT_ADDRESS  — Deployed EIP7702AutoForwarder contract address
 *   FORWARD_TARGET    — Address to forward ETH to (Wallet B)
 *   GAS_SPONSOR       — (Optional) Gas sponsor address, defaults to 0x0
 *   RPC_URL           — (Optional) RPC endpoint, defaults to Ankr Sepolia
 */

import { createWalletClient, createPublicClient, http, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { readFileSync } from 'fs';

// ── Load .env manually (no dotenv dependency needed) ──────────────
function loadEnv() {
    try {
        const envContent = readFileSync('.env', 'utf-8');
        for (const line of envContent.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) process.env[key] = val;
        }
    } catch {
        // .env file not found, rely on system env vars
    }
}
loadEnv();

// ── Configuration ────────────────────────────────────────────────
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const FORWARD_TARGET = process.env.FORWARD_TARGET;
const GAS_SPONSOR = process.env.GAS_SPONSOR || '0x0000000000000000000000000000000000000000';
const AUTO_FORWARD = process.env.AUTO_FORWARD !== 'false'; // default true
const RPC_URL = process.env.RPC_URL || 'https://rpc.ankr.com/eth_sepolia/ea7e5b99bbd88a55cfd8d3973165ef9bf11ac1149985999f88efdcd8f7bfe6de';

if (!PRIVATE_KEY || !CONTRACT_ADDRESS || !FORWARD_TARGET) {
    console.error('❌ Missing required environment variables.');
    console.error('   Required: PRIVATE_KEY, CONTRACT_ADDRESS, FORWARD_TARGET');
    console.error('   See .env.example for details.');
    process.exit(1);
}

// Validate that env vars are not still placeholder values
if (PRIVATE_KEY.includes('YOUR_') || CONTRACT_ADDRESS.includes('YOUR_') || FORWARD_TARGET.includes('YOUR_')) {
    console.error('❌ 请先编辑 .env 文件，将占位符替换为真实的值：');
    if (PRIVATE_KEY.includes('YOUR_')) console.error('   PRIVATE_KEY      → 你的 EOA 钱包私钥 (0x 开头的十六进制)');
    if (CONTRACT_ADDRESS.includes('YOUR_')) console.error('   CONTRACT_ADDRESS → 已部署的 EIP7702AutoForwarder 合约地址');
    if (FORWARD_TARGET.includes('YOUR_')) console.error('   FORWARD_TARGET   → ETH 转发目标地址 (钱包 B)');
    console.error('');
    console.error('   示例: PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    process.exit(1);
}

// Validate private key format
if (!/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) {
    console.error('❌ PRIVATE_KEY 格式无效。');
    console.error('   需要 0x 开头的 64 位十六进制字符串 (共 66 字符)。');
    console.error(`   当前值长度: ${PRIVATE_KEY.length} 字符`);
    process.exit(1);
}

// ── Minimal ABI for initialize() ─────────────────────────────────
const FORWARDER_ABI = [
    {
        name: 'initialize',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: '_forwardTarget', type: 'address' },
            { name: '_gasSponsor', type: 'address' },
            { name: '_autoForward', type: 'bool' },
        ],
        outputs: [],
    },
    {
        name: 'getConfig',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            { name: '_forwardTarget', type: 'address' },
            { name: '_gasSponsor', type: 'address' },
            { name: '_autoForwardEnabled', type: 'bool' },
            { name: '_initialized', type: 'bool' },
        ],
    },
];

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('  EIP-7702 Delegate & Initialize');
    console.log('═══════════════════════════════════════════════');
    console.log('');

    // 1. Create account from private key
    const account = privateKeyToAccount(PRIVATE_KEY);
    console.log(`📬 EOA Address:       ${account.address}`);
    console.log(`📄 Delegate Contract: ${CONTRACT_ADDRESS}`);
    console.log(`🎯 Forward Target:    ${FORWARD_TARGET}`);
    console.log(`⛽ Gas Sponsor:       ${GAS_SPONSOR}`);
    console.log(`🔄 Auto Forward:      ${AUTO_FORWARD}`);
    console.log(`🌐 RPC:               ${RPC_URL}`);
    console.log('');

    // 2. Create clients
    const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http(RPC_URL),
    });

    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(RPC_URL),
    });

    // 3. Check current balance
    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`💰 EOA Balance: ${Number(balance) / 1e18} ETH`);

    if (balance === 0n) {
        console.error('❌ EOA has no ETH. Get some Sepolia ETH from a faucet first.');
        process.exit(1);
    }

    // 4. Sign the EIP-7702 authorization
    console.log('');
    console.log('🔐 Signing EIP-7702 authorization...');
    const authorization = await walletClient.signAuthorization({
        contractAddress: CONTRACT_ADDRESS,
        executor: 'self',  // EOA signs and sends the tx itself
    });
    console.log('✅ Authorization signed.');

    // 5. Encode the initialize() calldata
    const initData = encodeFunctionData({
        abi: FORWARDER_ABI,
        functionName: 'initialize',
        args: [FORWARD_TARGET, GAS_SPONSOR, AUTO_FORWARD],
    });

    // 6. Send the type 0x04 transaction
    //    - authorizationList sets the EOA's code → delegate contract
    //    - data calls initialize() on the EOA (which now has the contract code)
    //    - to is the EOA's own address
    console.log('📤 Sending type 0x04 transaction (delegate + initialize)...');
    const hash = await walletClient.sendTransaction({
        authorizationList: [authorization],
        data: initData,
        to: account.address,
    });
    console.log(`📋 Tx Hash: ${hash}`);

    // 7. Wait for confirmation
    console.log('⏳ Waiting for confirmation...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
        console.log('');
        console.log('═══════════════════════════════════════════════');
        console.log('  ✅ Delegation & Initialization SUCCESS');
        console.log('═══════════════════════════════════════════════');
        console.log(`  Block:   ${receipt.blockNumber}`);
        console.log(`  Gas:     ${receipt.gasUsed}`);
        console.log('');

        // 8. Verify on-chain config
        try {
            const config = await publicClient.readContract({
                address: account.address,
                abi: FORWARDER_ABI,
                functionName: 'getConfig',
            });
            console.log('📖 On-chain config verification:');
            console.log(`   Forward Target:    ${config[0]}`);
            console.log(`   Gas Sponsor:       ${config[1]}`);
            console.log(`   Auto Forward:      ${config[2]}`);
            console.log(`   Initialized:       ${config[3]}`);
        } catch (err) {
            console.log('⚠️  Could not verify on-chain config (may need a moment to propagate)');
        }

        console.log('');
        console.log('🎉 Your EOA is now an auto-forwarding smart account!');
        console.log(`   Send ETH to ${account.address} and it will auto-forward to ${FORWARD_TARGET}`);
    } else {
        console.error('');
        console.error('❌ Transaction REVERTED on-chain.');
        console.error('   Check the transaction on Etherscan for details.');
    }
}

main().catch((err) => {
    console.error('');
    console.error('❌ Error:', err.shortMessage || err.message);
    if (err.details) console.error('   Details:', err.details);
    process.exit(1);
});
