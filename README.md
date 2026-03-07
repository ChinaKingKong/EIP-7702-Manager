# EIP-7702 Asset Manager

基于 EIP-7702 (Pectra) 协议的账户委托与资产安全管理工具。本工具利用 EIP-7702 的委托和代付特性，实现零余额账户的资产挽救、授权撤销以及自动化 ETH 搬运。

![demo](https://github.com/ChinaKingKong/EIP-7702-Manager/blob/main/src/assets/P0.png)

## ✨ 核心功能

### 1. 委托管理 (Authorization)
- **ETH 自动化搬运**：将 EOA 地址委托给智能合约（Auto-Forwarder），实现实时将存入的 ETH 自动转发至目标安全地址。
- **配置初始化**：支持设置转发目标地址、Gas 赞助商白名单以及自动转发开关。
- **灵活委托**：支持通过私钥直接进行 Type-0x04 交易委托，或通过浏览器钱包进行普通委托。

### 2. 授权管理 (Revoke Authorization)
- **资产全量扫描**：利用 Ankr Advanced API 快速检索账户历史所有的 ERC20 代币和 NFT (ERC721/ERC1155) 授权记录。
- **精准筛选**：自动过滤已撤销的旧记录，仅展示当前依然有效的授权，并支持最近 30 条记录的深度追踪。
- **混合代付撤销**：
  - **针对普通 EOA**：自动打包 EIP-7702 授权与 Intent 签名，实现由赞助商支付 Gas 的“一键撤销”。
  - **针对已委托账户**：使用基于 EIP-712 的 Intent 签名流程，在不破坏委托状态的前提下由赞助商代付撤销。
- **一键清理**：支持撤销 EIP-7702 委托状态，将账户还原为标准 EOA。

### 3. 资产搬运 (Asset Sweep)
- **ERC20/NFT 挽救**：针对已授权或原生持有的 ERC20 代币及 NFT，支持在被盗账户（EOA）中由赞助商代付 Gas，将其强制搬运至安全地址。
- **自动检测系统**：自动扫描账户中的所有主流代币资产，支持单个或批量搬运任务。
- **防抢跑机制**：利用 EIP-7702 的 0x04 交易特性，确保搬运操作在黑客监测到 ETH 转入前即可完成签名执行。

### 4. 赞助商代付系统 (Gas Sponsorship)
- **全局代付设置**：支持在页面配置全局 Gas 赞助商私钥。
- **无感代付体验**：在用户账户余额为 0 的情况下，依然可以完成代币转移、授权撤销等高成本操作。

## 🚀 快速启动

### 运行环境要求
- Node.js (v18+)
- 支持 EIP-7702 的区块链节点 (如 Sepolia, Holesky 或主网)

### 安装与运行
1. **安装依赖**：
   ```bash
   npm install
   ```
2. **启动开发服务器**：
   ```bash
   npm run dev
   ```

### 配置环境变量 (`.env`)
在工程根目录下创建 `.env` 文件，配置如下关键参数：
```env
# Ankr 多链 API 密钥（用于资产扫描）
VITE_ANKR_API_KEY=your_ankr_api_key

# 主网 RPC（建议使用支持 EIP-7702 的 Ankr 节点）
VITE_RPC_URL_1=https://rpc.ankr.com/eth/[your_key]

# 测试网 RPC
VITE_RPC_URL_11155111=https://rpc.ankr.com/eth_sepolia
VITE_RPC_URL_17000=https://rpc.ankr.com/eth_holesky 
```

## 📖 使用指南

### 场景一：挽救丢金地址中的资产（账号余额为 0）
1. 进入 **Revoke Authorization** 页面。
2. 输入被盗/丢失账户的 **私钥**，系统会自动扫描该账户已授权的资产。
3. 在页面顶部的 **Sponsor Key** 区域输入一个存有少量 ETH 的赞助商私钥。
4. 点击对应资产右侧的 **Sponsored Revoke**，系统将自动使用赞助商的 Gas 完成授权撤销或资产提取。

### 场景二：设置 ETH 自动抢跑搬运
1. 进入 **Authorization** 页面。
2. 输入当前账户私钥以及 **转发目标地址**（您的安全钱包）。
3. 指定 **赞助商地址**（用于后续自动转发时的 Gas 代付）。
4. 点击 **Delegate & Initialize**。此时任何转入该账户的 ETH 都会被自动搬运至目标地址。

### 场景三：查看及清理历史风险授权
1. 在 **Revoke Authorization** 页面直接通过钱包连接或输入地址。
2. 浏览历史授权列表，识别可疑的 Spender（支出者）。
3. 点击 **Revoke** 手动执行撤销，或使用 **Sponsored Revoke** 进行零成本清理。

### 场景四：零 ETH 搬运被盗账户资产
1. 进入 **Forwarding Token** 或 **Forwarding NFT** 页面。
2. 输入被盗账户私钥、赞助商私钥及接收资产的安全地址。
3. 点击 **Scan Tokens/NFTs** 自动识别账户资产。
4. 点击 **Sweep**。系统将利用 EIP-7702 的代付机制，在被盗账户无需任何 ETH 的情况下，由赞助商支付 Gas 完成资产提取。

## 🛠 技术实现
- **Viem**: 深度整合 EIP-7702 签名逻辑（signAuthorization）及类型化数据签名（signTypedData）。
- **Ankr Advanced API**: 用于高性能的链上日志检索与资产索引。
- **React + Tailwind**: 提供流畅、专业的管理界面。
- **Hybrid Intent Flow**: 独创的 Intent + Authorization 捆绑技术，确保代付交易中 `msg.sender` 的准确性。

---
> [!IMPORTANT]
> 本工具仅供技术研究及正当资产拯救使用。在使用私钥模式时，请务必在安全隔离的环境下运行。
