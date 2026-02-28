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

export function saveDeployedContract({ name, address, chainId }) {
    const list = getDeployedContracts();
    // Avoid duplicates by address (case-insensitive)
    const exists = list.some((c) => c.address.toLowerCase() === address.toLowerCase());
    if (!exists) {
        list.unshift({ name, address, chainId, timestamp: Date.now() });
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
