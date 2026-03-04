#!/usr/bin/env node
/**
 * EIP-7702 Forward All ETH Script
 *
 * After delegation is set up (via delegate.mjs), this script
 * calls forwardAllETH() on the delegated EOA to manually transfer
 * all ETH balance to the configured forwardTarget.
 *
 * Note: If autoForwardEnabled is true, incoming ETH is forwarded
 * automatically via receive(). This script is for manually sweeping
 * any remaining balance.
 *
 * Usage:
 *   node scripts/forward-eth.mjs
 *
 * Required env vars (in .env):
 *   PRIVATE_KEY  — EOA private key (hex, with 0x prefix)
 *   RPC_URL      — (Optional) RPC endpoint, defaults to Ankr Sepolia
 */

import { createWalletClient, createPublicClient, http, encodeFunctionData, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { readFileSync } from 'fs';

// ── Load .env manually ──────────────────────────────────────────
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
        // .env file not found
    }
}
loadEnv();

// ── Configuration ───────────────────────────────────────────────
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || 'https://rpc.ankr.com/eth_sepolia/ea7e5b99bbd88a55cfd8d3973165ef9bf11ac1149985999f88efdcd8f7bfe6de';

if (!PRIVATE_KEY) {
    console.error('❌ Missing PRIVATE_KEY in .env');
    process.exit(1);
}

// ── Minimal ABI ─────────────────────────────────────────────────
const FORWARDER_ABI = [
    {
        name: 'forwardAllETH',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [],
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
    console.log('  EIP-7702 Manual ETH Forward');
    console.log('═══════════════════════════════════════════════');
    console.log('');

    const account = privateKeyToAccount(PRIVATE_KEY);
    console.log(`📬 EOA Address: ${account.address}`);

    const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http(RPC_URL),
    });

    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(RPC_URL),
    });

    // Check current balance
    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`💰 Current Balance: ${formatEther(balance)} ETH`);

    if (balance === 0n) {
        console.log('ℹ️  No ETH to forward.');
        return;
    }

    // Check delegation config
    try {
        const config = await publicClient.readContract({
            address: account.address,
            abi: FORWARDER_ABI,
            functionName: 'getConfig',
        });
        console.log(`🎯 Forward Target:  ${config[0]}`);
        console.log(`🔄 Auto Forward:    ${config[2]}`);
        console.log(`✅ Initialized:     ${config[3]}`);

        if (!config[3]) {
            console.error('❌ Contract not initialized! Run delegate.mjs first.');
            process.exit(1);
        }
    } catch {
        console.error('❌ Cannot read contract config. Has delegation been set up?');
        console.error('   Run: node scripts/delegate.mjs');
        process.exit(1);
    }

    // Call forwardAllETH() on the EOA
    const calldata = encodeFunctionData({
        abi: FORWARDER_ABI,
        functionName: 'forwardAllETH',
    });

    console.log('');
    console.log('📤 Calling forwardAllETH()...');
    const hash = await walletClient.sendTransaction({
        to: account.address,
        data: calldata,
    });
    console.log(`📋 Tx Hash: ${hash}`);

    console.log('⏳ Waiting for confirmation...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
        const newBalance = await publicClient.getBalance({ address: account.address });
        console.log('');
        console.log('✅ ETH forwarded successfully!');
        console.log(`   Forwarded: ${formatEther(balance - newBalance)} ETH`);
        console.log(`   Remaining: ${formatEther(newBalance)} ETH`);
    } else {
        console.error('❌ Transaction reverted.');
    }
}

main().catch((err) => {
    console.error('❌ Error:', err.shortMessage || err.message);
    process.exit(1);
});
