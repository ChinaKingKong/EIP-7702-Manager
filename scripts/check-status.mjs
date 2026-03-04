#!/usr/bin/env node
/**
 * EIP-7702 Delegation Status Check
 * Diagnoses whether the EOA has delegation code set and whether storage is initialized.
 */

import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { readFileSync } from 'fs';

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
    } catch { }
}
loadEnv();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL || 'https://rpc.ankr.com/eth_sepolia/ea7e5b99bbd88a55cfd8d3973165ef9bf11ac1149985999f88efdcd8f7bfe6de';

const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('  EIP-7702 Delegation Diagnostic');
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log(`📬 EOA Address:        ${account.address}`);
    console.log(`📄 Expected Delegate:  ${CONTRACT_ADDRESS}`);
    console.log('');

    // 1. Check EOA code
    const code = await publicClient.getCode({ address: account.address });
    console.log(`🔍 EOA Code: ${code || '(empty — no delegation)'}`);

    if (code && code !== '0x') {
        // EIP-7702 delegation indicator is 0xef0100 + 20-byte address
        if (code.startsWith('0xef0100')) {
            const delegateAddr = '0x' + code.slice(8); // remove 0xef0100
            console.log(`✅ Delegation ACTIVE → ${delegateAddr}`);

            if (delegateAddr.toLowerCase() === CONTRACT_ADDRESS?.toLowerCase()) {
                console.log('✅ Delegate matches CONTRACT_ADDRESS');
            } else {
                console.log('⚠️  Delegate does NOT match CONTRACT_ADDRESS');
            }
        } else {
            console.log(`ℹ️  Code exists but is not EIP-7702 delegation indicator`);
        }
    } else {
        console.log('❌ No code on EOA — delegation is NOT active');
        console.log('   The delegation may have been cleared or was transaction-scoped only.');
    }

    // 2. Check balance
    const balance = await publicClient.getBalance({ address: account.address });
    console.log('');
    console.log(`💰 EOA Balance: ${Number(balance) / 1e18} ETH`);

    // 3. Try reading storage slots directly
    console.log('');
    console.log('📖 Reading storage slots on EOA:');
    // Storage layout of EIP7702AutoForwarder:
    //   Slot 0: forwardTarget (address)
    //   Slot 1: gasSponsor (address, packed with autoForwardEnabled and initialized)
    //   Slot 2: nonce (uint256)
    const slot0 = await publicClient.getStorageAt({ address: account.address, slot: '0x0' });
    const slot1 = await publicClient.getStorageAt({ address: account.address, slot: '0x1' });
    const slot2 = await publicClient.getStorageAt({ address: account.address, slot: '0x2' });
    console.log(`   Slot 0 (forwardTarget):    ${slot0}`);
    console.log(`   Slot 1 (gasSponsor+flags): ${slot1}`);
    console.log(`   Slot 2 (nonce):            ${slot2}`);

    // 4. Try getConfig
    console.log('');
    console.log('📖 Trying getConfig() call:');
    try {
        const FORWARDER_ABI = [{
            name: 'getConfig', type: 'function', stateMutability: 'view',
            inputs: [],
            outputs: [
                { name: '_forwardTarget', type: 'address' },
                { name: '_gasSponsor', type: 'address' },
                { name: '_autoForwardEnabled', type: 'bool' },
                { name: '_initialized', type: 'bool' },
            ],
        }];
        const config = await publicClient.readContract({
            address: account.address,
            abi: FORWARDER_ABI,
            functionName: 'getConfig',
        });
        console.log(`   Forward Target:    ${config[0]}`);
        console.log(`   Gas Sponsor:       ${config[1]}`);
        console.log(`   Auto Forward:      ${config[2]}`);
        console.log(`   Initialized:       ${config[3]}`);
    } catch (err) {
        console.log(`   ❌ Failed: ${err.shortMessage || err.message}`);
    }

    // 5. Check delegate contract code
    if (CONTRACT_ADDRESS) {
        console.log('');
        const contractCode = await publicClient.getCode({ address: CONTRACT_ADDRESS });
        if (contractCode && contractCode !== '0x') {
            console.log(`✅ Delegate contract has code (${contractCode.length / 2 - 1} bytes)`);
        } else {
            console.log('❌ Delegate contract has NO code — was it deployed on Sepolia?');
        }
    }
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
