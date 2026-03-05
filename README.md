# EIP-7702 Manager Dashboard

A modern, decentralized application (dApp) built to manage and demonstrate the capabilities of Ethereum Improvement Proposal (EIP) 7702. 

The EIP-7702 Manager allows Externally Owned Accounts (EOAs) to temporarily act as Smart Contract Accounts during a transaction, enabling advanced features like gas sponsorship, transaction batching, and automated asset forwarding—all while maintaining the security and control of a standard wallet.

## 🌟 Key Features

* **EIP-7702 Authorization Management:** Grant, view, and revoke smart contract delegation authorizations for your EOA.
* **Gas Sponsorship (Paymaster):** Experience zero-gas transactions. Deploy and interact with contracts without needing native ETH in the operating wallet.
* **Auto-Forwarding / Sweeping:** Configure rules to automatically forward incoming native tokens (ETH). Supports optional custom recipient addresses for ERC-20 asset sweeps.
* **Multi-Chain Asset Scanner:** Integrated Ankr Advanced API to automatically discover and sweep ERC-20 tokens across Sepolia, Holesky, and Mainnet.
* **Optimized for Mainnet:** Enhanced deployment logic with pre-flight balance checks, gas estimation, and buffers to ensure stability on high-traffic networks.
* **Premium UX/UI:** Smooth loading transitions, real-time toast notifications, and unified design aesthetics.
* **Internationalization (i18n):** Full support for English and Simplified Chinese (简体中文).

## 🛠 Tech Stack

* **Frontend Framework:** React 18 + Vite
* **Styling:** Custom CSS with CSS Variables (Dark theme optimized)
* **Web3 Integration:** [Viem](https://viem.sh/) (for interacting with Ethereum/EVM chains)
* **Routing:** React Router v6
* **Notifications:** React Hot Toast
* **Icons:** Lucide React

## 🚀 Getting Started

### Prerequisites

* Node.js (v18+ recommended)
* npm or yarn
* A Web3 Wallet (e.g., MetaMask, Rabby) connected to a supported testnet (Sepolia/Holesky).

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ChinaKingKong/EIP-7702-Manager.git
   cd EIP-7702-Manager
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory based on `.env.example` (or configure directly):
   ```env
   # --- Vite Client Environment Variables ---
   VITE_RPC_URL_1=https://rpc.ankr.com/eth/YOUR_API_KEY
   VITE_RPC_URL_11155111=https://rpc.ankr.com/eth_sepolia/YOUR_API_KEY
   VITE_RPC_URL_17000=https://rpc.ankr.com/eth_holesky/YOUR_API_KEY
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The app will be running at `http://localhost:5173`.

## 🌐 Deployment

This project uses `BrowserRouter`. If deploying to a static host like Vercel or Nginx, you must configure rewrite rules to point all routes to `index.html`.

* **Vercel:** A `vercel.json` file is already included in the repository. Simply connect your GitHub repo to Vercel and it will work out of the box.
* **Nginx:** Configure your location block:
  ```nginx
  location / {
    try_files $uri $uri/ /index.html;
  }
  ```

## 🔐 Security Notice

This dashboard interacts with experimental EIP-7702 features. 
* Always use **Testnet networks** (Sepolia/Holesky) and **Test wallets** when experimenting.
* Do not enter the private key of a wallet containing real mainnet assets.
* Understand that delegating your EOA to a smart contract grants that contract complete control over your account's execution context during the transaction.

## 📄 License

MIT License
