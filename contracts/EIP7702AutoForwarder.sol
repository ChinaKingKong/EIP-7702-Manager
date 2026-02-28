// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title EIP7702AutoForwarder
 * @author EIP-7702 Dashboard
 *
 * @notice EIP-7702 委托合约 — 自动转发 ETH & ERC20 代币
 *
 * ═══════════════════════════════════════════════════════════
 *  EIP-7702 协议原生机制说明:
 * ═══════════════════════════════════════════════════════════
 *
 *  Gas 代付:
 *    EIP-7702 的 type 0x04 交易自带 gas 代付功能。
 *    EOA 离线签署 authorization tuple [chain_id, address, nonce, y_parity, r, s]，
 *    任何第三方 (sponsor) 可以将此 authorization 包含在自己提交的交易中，
 *    并支付 gas 费用。无需在合约层面重新实现 meta-transaction。
 *
 *    工作流程:
 *    1. EOA (Alice) 离线签名: sign(MAGIC || rlp([chain_id, this_contract, nonce]))
 *    2. Sponsor (Bob) 构建 type 0x04 交易，包含 Alice 的 authorization
 *    3. Bob 提交交易并支付 gas，Alice 的 EOA 代码指向本合约
 *    4. 后续 Bob 可以以 Alice 的 EOA 为 destination 提交交易，
 *       调用本合约的函数 (如 sweepToken)，gas 由 Bob 支付
 *
 *  自动转发:
 *    委托设置后，EOA 的 receive() 函数由本合约提供。
 *    当有人向 EOA 发送 ETH 时，自动转发到 forwardTarget。
 *    ERC20 需要通过 sweepToken() 手动或由 sponsor 代为调用。
 *
 * ═══════════════════════════════════════════════════════════
 *  合约功能:
 * ═══════════════════════════════════════════════════════════
 *
 *  1. ETH 自动转发 — receive() 收到 ETH 自动转入 forwardTarget
 *  2. ERC20 搬运 — sweepToken() / sweepTokens() 批量转出
 *  3. 通用执行 — execute() / executeBatch() 任意合约调用
 *  4. 访问控制 — 配置仅限 EOA 本人，操作允许 EOA 或 sponsor
 */
contract EIP7702AutoForwarder {

    // ═══════════════════════════════════════════
    //  Storage (存储在委托的 EOA 上)
    // ═══════════════════════════════════════════

    /// @notice 资金转发目标地址
    address public forwardTarget;

    /// @notice Gas 代付人地址 (通过 EIP-7702 原生机制代付 gas，
    ///         此处记录 sponsor 以允许其调用 sweep/execute 等操作)
    address public gasSponsor;

    /// @notice 是否启用 ETH 自动转发
    bool public autoForwardEnabled;

    /// @notice 是否已初始化
    bool public initialized;

    /// @notice 操作 nonce (用于签名验证的重放保护)
    uint256 public nonce;

    // ═══════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════

    event Initialized(address indexed forwardTarget, address indexed gasSponsor);
    event ConfigUpdated(address indexed forwardTarget, address indexed gasSponsor, bool autoForward);
    event ETHForwarded(address indexed from, address indexed to, uint256 amount);
    event ETHReceived(address indexed from, uint256 amount);
    event TokenSwept(address indexed token, address indexed to, uint256 amount);
    event Executed(address indexed to, uint256 value, bytes data);

    // ═══════════════════════════════════════════
    //  Errors
    // ═══════════════════════════════════════════

    error Unauthorized();
    error AlreadyInitialized();
    error ZeroAddress();
    error ForwardFailed();
    error TokenTransferFailed();
    error NoTokenBalance();
    error ExecutionFailed();
    error LengthMismatch();

    // ═══════════════════════════════════════════
    //  Modifiers
    // ═══════════════════════════════════════════

    /**
     * @dev 仅 EOA 本人可调用
     * EIP-7702 下，EOA 直接发起交易时 msg.sender == address(this)
     */
    modifier onlySelf() {
        if (msg.sender != address(this)) revert Unauthorized();
        _;
    }

    /**
     * @dev EOA 本人 或 sponsor 可调用
     * Sponsor 通过 EIP-7702 原生方式提交交易 (代付 gas)，
     * 以 EOA 地址为 destination 调用本合约函数
     */
    modifier onlySelfOrSponsor() {
        if (msg.sender != address(this) && msg.sender != gasSponsor)
            revert Unauthorized();
        _;
    }

    // ═══════════════════════════════════════════
    //  Initialization
    // ═══════════════════════════════════════════

    /**
     * @notice 初始化委托设置
     * @dev 仅可调用一次，需由 EOA 本人调用
     *      EIP-7702 安全建议: 防止前置运行攻击，初始化必须由 EOA 本人执行
     *
     * @param _forwardTarget 资金转发目标地址
     * @param _gasSponsor Gas 代付人地址 (0x0 = 无 sponsor)
     * @param _autoForward 是否启用 ETH 自动转发
     */
    function initialize(
        address _forwardTarget,
        address _gasSponsor,
        bool _autoForward
    ) external onlySelf {
        if (initialized) revert AlreadyInitialized();
        if (_forwardTarget == address(0)) revert ZeroAddress();

        forwardTarget = _forwardTarget;
        gasSponsor = _gasSponsor;
        autoForwardEnabled = _autoForward;
        initialized = true;

        emit Initialized(_forwardTarget, _gasSponsor);
    }

    // ═══════════════════════════════════════════
    //  Configuration (仅 EOA 本人)
    // ═══════════════════════════════════════════

    /**
     * @notice 更新转发目标地址
     */
    function setForwardTarget(address _target) external onlySelf {
        if (_target == address(0)) revert ZeroAddress();
        forwardTarget = _target;
        emit ConfigUpdated(forwardTarget, gasSponsor, autoForwardEnabled);
    }

    /**
     * @notice 更新 Gas 代付人
     * @param _sponsor 新的 sponsor (address(0) = 取消 sponsor)
     */
    function setGasSponsor(address _sponsor) external onlySelf {
        gasSponsor = _sponsor;
        emit ConfigUpdated(forwardTarget, gasSponsor, autoForwardEnabled);
    }

    /**
     * @notice 开关 ETH 自动转发
     */
    function setAutoForward(bool _enabled) external onlySelf {
        autoForwardEnabled = _enabled;
        emit ConfigUpdated(forwardTarget, gasSponsor, autoForwardEnabled);
    }

    /**
     * @notice 一次性更新全部配置
     */
    function updateConfig(
        address _forwardTarget,
        address _gasSponsor,
        bool _autoForward
    ) external onlySelf {
        if (_forwardTarget == address(0)) revert ZeroAddress();
        forwardTarget = _forwardTarget;
        gasSponsor = _gasSponsor;
        autoForwardEnabled = _autoForward;
        emit ConfigUpdated(_forwardTarget, _gasSponsor, _autoForward);
    }

    // ═══════════════════════════════════════════
    //  ETH 自动转发
    // ═══════════════════════════════════════════

    /**
     * @notice 接收 ETH — 自动转发到 forwardTarget
     * @dev 当 autoForwardEnabled=true 且 forwardTarget 已设置时，
     *      所有收到的 ETH 立即转发到目标地址
     */
    receive() external payable {
        if (autoForwardEnabled && forwardTarget != address(0) && msg.value > 0) {
            (bool success, ) = forwardTarget.call{value: msg.value}("");
            if (!success) revert ForwardFailed();
            emit ETHForwarded(msg.sender, forwardTarget, msg.value);
        } else {
            emit ETHReceived(msg.sender, msg.value);
        }
    }

    fallback() external payable {
        if (autoForwardEnabled && forwardTarget != address(0) && msg.value > 0) {
            (bool success, ) = forwardTarget.call{value: msg.value}("");
            if (!success) revert ForwardFailed();
            emit ETHForwarded(msg.sender, forwardTarget, msg.value);
        }
    }

    /**
     * @notice 手动转发 EOA 中的全部 ETH 到 forwardTarget
     * @dev 可由 EOA 本人或 sponsor 调用
     *      sponsor 调用时：sponsor 提交交易 (代付 gas)，destination = 本 EOA
     */
    function forwardAllETH() external onlySelfOrSponsor {
        if (forwardTarget == address(0)) revert ZeroAddress();
        uint256 bal = address(this).balance;
        if (bal == 0) return;
        (bool success, ) = forwardTarget.call{value: bal}("");
        if (!success) revert ForwardFailed();
        emit ETHForwarded(address(this), forwardTarget, bal);
    }

    // ═══════════════════════════════════════════
    //  ERC20 代币搬运
    // ═══════════════════════════════════════════

    /**
     * @notice 将指定 ERC20 代币全部搬运到 forwardTarget
     * @dev ERC20 的 transfer() 不通知接收方，无法自动触发。
     *      需要主动调用此函数，或由 sponsor 代为调用。
     *      搭配链下监控 Transfer 事件，可实现"准自动"搬运。
     *
     *      Gas 代付流程 (EIP-7702 原生):
     *      1. Sponsor 以 EOA 地址为 destination 发送交易
     *      2. 交易 data = abi.encodeCall(sweepToken, (tokenAddress))
     *      3. Sponsor 支付 gas，代币从 EOA 转到 forwardTarget
     */
    function sweepToken(address token) external onlySelfOrSponsor {
        if (forwardTarget == address(0)) revert ZeroAddress();

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert NoTokenBalance();

        bool success = IERC20(token).transfer(forwardTarget, balance);
        if (!success) revert TokenTransferFailed();

        emit TokenSwept(token, forwardTarget, balance);
    }

    /**
     * @notice 批量搬运多个 ERC20 代币
     * @param tokens ERC20 代币合约地址数组
     */
    function sweepTokens(address[] calldata tokens) external onlySelfOrSponsor {
        if (forwardTarget == address(0)) revert ZeroAddress();

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                bool success = IERC20(tokens[i]).transfer(forwardTarget, balance);
                if (!success) revert TokenTransferFailed();
                emit TokenSwept(tokens[i], forwardTarget, balance);
            }
        }
    }

    // ═══════════════════════════════════════════
    //  通用执行
    // ═══════════════════════════════════════════

    /**
     * @notice EOA 通过委托合约执行任意调用
     * @dev 仅 EOA 本人可调用, sponsor 不可直接调用此函数
     *      (sponsor 通过 EIP-7702 原生方式已经可以代付 gas,
     *       但执行权限仍由 EOA 控制)
     */
    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlySelf returns (bytes memory) {
        (bool success, bytes memory result) = to.call{value: value}(data);
        if (!success) revert ExecutionFailed();
        emit Executed(to, value, data);
        return result;
    }

    /**
     * @notice 批量执行 — 一笔交易完成多个操作
     * @dev EIP-7702 核心优势之一: batch transactions
     */
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas
    ) external onlySelf {
        if (targets.length != values.length || values.length != calldatas.length)
            revert LengthMismatch();

        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, ) = targets[i].call{value: values[i]}(calldatas[i]);
            if (!success) revert ExecutionFailed();
            emit Executed(targets[i], values[i], calldatas[i]);
        }
    }

    // ═══════════════════════════════════════════
    //  View Functions
    // ═══════════════════════════════════════════

    /// @notice 获取 EOA 的 ETH 余额
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice 获取 EOA 某个 ERC20 代币余额
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /// @notice 获取完整配置
    function getConfig()
        external
        view
        returns (
            address _forwardTarget,
            address _gasSponsor,
            bool _autoForwardEnabled,
            bool _initialized
        )
    {
        return (forwardTarget, gasSponsor, autoForwardEnabled, initialized);
    }

    // ═══════════════════════════════════════════
    //  撤销委托
    // ═══════════════════════════════════════════

    /**
     * @notice 撤销委托前的清理
     * @dev 在通过 EIP-7702 撤销委托（将 delegation address 设为 0x0）前，
     *      建议先调用此函数转出所有资金。
     *      撤销方法: 发送 type 0x04 交易，authorization 中 address = 0x0
     */
    function prepareRevoke() external onlySelf {
        // 转出所有 ETH 到 forwardTarget
        if (forwardTarget != address(0) && address(this).balance > 0) {
            (bool success, ) = forwardTarget.call{value: address(this).balance}("");
            if (!success) revert ForwardFailed();
            emit ETHForwarded(address(this), forwardTarget, address(this).balance);
        }
    }
}

// ═══════════════════════════════════════════
//  IERC20 最小接口
// ═══════════════════════════════════════════

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
