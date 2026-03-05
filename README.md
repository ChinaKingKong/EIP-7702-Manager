# EIP-7702 Manager Dashboard

基于 EIP-7702 的委托与代币管理前端：支持 EOA 委托给智能合约、赞助商代付 Gas、以及将 EOA 持有的 ERC20 代币搬运到指定地址。

## 功能概览

* **转发授权**：使用转出钱包私钥 + 委托合约 + 转发目标，执行 EIP-7702 委托并初始化（或更新）链上配置。可选填写「Gas 赞助商私钥」，由赞助商支付 Gas 并将链上 Gas 代付人设为该赞助商，便于后续代币搬运。
* **代币搬运**：仅支持赞助模式。填写转出钱包私钥、Gas 赞助商私钥（必填）、代币接收地址（必填），选择与转发授权一致的委托合约后，由赞助商代付 Gas 调用操作账户的 `sweepTokenTo(token, 接收地址)`，将 ERC20 从转出钱包转到指定地址。
* **部署合约**：在支持的链上部署 EIP7702AutoForwarder 委托合约。
* **Gas 代付**：EIP-712 + EIP-7702 的异步 Gas 赞助流程（签署意图、赞助方代付）。
* **多链与 i18n**：支持 Ethereum 主网、Sepolia、Holesky；界面支持简体中文与英文。

## 技术栈

* React 18 + Vite
* 样式：自定义 CSS + CSS 变量（深色主题）
* 链上交互：[Viem](https://viem.sh/)
* 路由：React Router v6；通知：React Hot Toast；图标：Lucide React

## 快速开始

### 环境要求

* Node.js 18+
* npm 或 yarn

### 安装与运行

1. 克隆并安装依赖：
   ```bash
   git clone https://github.com/ChinaKingKong/EIP-7702-Manager.git
   cd EIP-7702-Manager
   npm install
   ```

2. 配置环境变量（根目录 `.env`，参考 `.env.example`）：
   ```env
   # 主网 RPC（代币搬运建议使用支持 EIP-7702 的节点，如 Infura）
   VITE_RPC_URL_1=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
   # 测试网（可选）
   VITE_RPC_URL_11155111=https://rpc.ankr.com/eth_sepolia
   VITE_RPC_URL_17000=https://rpc.ankr.com/eth_holesky
   ```
   **注意**：`VITE_*` 在构建时注入，修改 `.env` 后必须重新执行 `npm run build`（或 `npm run dev` 会热加载）后才会生效。

3. 启动开发服务：
   ```bash
   npm run dev
   ```
   访问 `http://localhost:5173`。

### 构建与部署

```bash
npm run build
```

使用 `BrowserRouter`，静态部署时需将路由回退到 `index.html`（如 Vercel 已包含 `vercel.json`；Nginx 使用 `try_files $uri $uri/ /index.html;`）。

## 使用说明（代币搬运）

1. 在 **转发授权** 页：填写转出钱包私钥、选择委托合约、填写转发目标；**若要在代币搬运时由赞助商代付 Gas，必须填写与搬运页相同的「Gas 赞助商私钥」**，否则链上 Gas 代付人为空，搬运会报错。
2. 在 **代币搬运** 页：填写转出钱包私钥、Gas 赞助商私钥（必填）、代币接收地址（必填），选择与转发授权相同的委托合约，扫描或输入代币合约地址后执行搬运。
3. **主网当前限制**：若交易成功但区块浏览器中无内部交易、代币未转移，说明主网执行层在对「发往 EOA 的带 data 交易」时可能未运行委托合约代码（EIP-7702 执行支持限制）。建议先在 Sepolia/Holesky 等测试网验证代币搬运流程。

## 安全提示

* 本应用涉及 EIP-7702 实验特性与私钥输入，请优先在测试网与测试钱包上使用。
* 勿将持有主网资产的钱包私钥填入。
* 委托 EOA 给合约后，该合约在交易上下文中可代表 EOA 执行逻辑，请仅委托可信合约。

## License

MIT
