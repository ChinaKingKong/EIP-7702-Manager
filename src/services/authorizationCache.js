/**
 * Authorization Cache — localStorage utility
 * Stores signed EIP-7702 authorizations for persistence across page navigations.
 */
const STORAGE_KEY = 'eip7702_authorizations';

export function getAuthorizations() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveAuthorization(auth) {
    const list = getAuthorizations();
    // Avoid duplicates by id
    const exists = list.some((a) => a.id === auth.id);
    if (!exists) {
        list.unshift(auth);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch { }
    }
    return list;
}

export function updateAuthorization(authId, updates) {
    const list = getAuthorizations().map((a) =>
        a.id === authId ? { ...a, ...updates } : a
    );
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch { }
    return list;
}

export function removeAuthorization(authId) {
    const list = getAuthorizations().filter((a) => a.id !== authId);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch { }
    return list;
}

export function getActiveAuthorizations() {
    return getAuthorizations().filter((a) => a.status === 'active');
}
