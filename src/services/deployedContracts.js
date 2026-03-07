/**
 * Deployed Contract Cache — localStorage utility
 * Stores { name, address, chainId, timestamp } for each deployed contract.
 */
const STORAGE_KEY = 'eip7702_deployed_contracts';

export function getDeployedContracts() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function getDeployedContractsByChainId(chainId) {
    const all = getDeployedContracts();
    return all.filter(c => Number(c.chainId) === Number(chainId));
}

export function saveDeployedContract({ name, address, chainId, deployer }) {
    const list = getDeployedContracts();
    // Avoid duplicates by address (case-insensitive)
    const exists = list.some((c) => c.address.toLowerCase() === address.toLowerCase());
    if (!exists) {
        list.unshift({ name, address, chainId, deployer: deployer?.toLowerCase(), timestamp: Date.now() });
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch { }
    }
    return list;
}

export function removeDeployedContract(address) {
    const list = getDeployedContracts().filter(
        (c) => c.address.toLowerCase() !== address.toLowerCase()
    );
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch { }
    return list;
}
