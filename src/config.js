export const RPC_URLS = {
    1: import.meta.env.VITE_RPC_URL_1 || 'https://rpc.ankr.com/eth',
    11155111: import.meta.env.VITE_RPC_URL_11155111 || 'https://rpc.ankr.com/eth_sepolia',
    17000: import.meta.env.VITE_RPC_URL_17000 || 'https://rpc.ankr.com/eth_holesky',
};

export const DEFAULT_CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0xde90806f313787c273d07e52e985e012b5bde382';
