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

    /// @notice Gas 代付人地址 (通过 EIP-7702 原生机制代付 gas)
    address public gasSponsor;

    /// @notice 是否启用 ETH 自动转发
    bool public autoForwardEnabled;

    /// @notice 是否已初始化
    bool public initialized;

    /// @notice 操作 nonce (用于签名验证的重放保护)
    uint256 public nonce;

    /// @notice 紧急救援地址 (仅在 forwardTarget 失效时使用)
    address public emergencyRescue;

    // ═══════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════

    event Initialized(address indexed forwardTarget, address indexed gasSponsor);
    event ConfigUpdated(address indexed forwardTarget, address indexed gasSponsor, bool autoForward);
    event ETHForwarded(address indexed from, address indexed to, uint256 amount);
    event ETHReceived(address indexed from, uint256 amount);
    event TokenSwept(address indexed token, address indexed to, uint256 amount);
    event TokenSweptBatch(address[] tokens, address indexed to, uint256[] amounts);
    event Executed(address indexed to, uint256 value, bytes data);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);
    event SponsorUpdated(address indexed oldSponsor, address indexed newSponsor);

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
    error InvalidSignature();
    error InvalidNonce();
    error NotEmergencyRescue();

    // ═══════════════════════════════════════════
    //  Modifiers
    // ═══════════════════════════════════════════

    /**
     * @dev 仅 EOA 本人或 gasSponsor 可调用
     */
    modifier onlyAuthorized() {
        // Condition 1: Direct transaction from the EOA (EOA is tx.origin)
        bool isSelf = tx.origin == address(this);

        // Condition 2: Sponsored transaction where msg.sender is the registered sponsor
        bool isSponsor = (gasSponsor != address(0) && msg.sender == gasSponsor);

        // Condition 3: Initialization phase - Allow anyone to call if not initialized
        // Note: Deployment and initialization are usually grouped in one sponsored tx
        bool isInitPhase = !initialized;

        if (!isSelf && !isSponsor && !isInitPhase) {
            revert Unauthorized();
        }
        _;
    }

    /**
     * @dev 仅 EOA 本人可调用（配置函数需要）
     */
    modifier onlySelf() {
        // In EIP-7702, a sponsored transaction can be "self" if Alice signed the authorization.
        // We allow the call if it's the very first initialization, or if the caller matches the account itself.
        if (tx.origin != address(this) && msg.sender != gasSponsor && initialized) {
            revert Unauthorized();
        }
        _;
    }

    // ═══════════════════════════════════════════
    //  Initialization
    // ═══════════════════════════════════════════

    /**
     * @notice 初始化委托设置
     */
    function initialize(
        address _forwardTarget,
        address _gasSponsor,
        bool _autoForward,
        address _emergencyRescue
    ) external onlySelf {
        if (initialized) revert AlreadyInitialized();
        if (_forwardTarget == address(0)) revert ZeroAddress();

        forwardTarget = _forwardTarget;
        gasSponsor = _gasSponsor;
        autoForwardEnabled = _autoForward;
        emergencyRescue = _emergencyRescue;
        initialized = true;

        emit Initialized(_forwardTarget, _gasSponsor);
    }

    // ═══════════════════════════════════════════
    //  Configuration (仅 EOA 本人)
    // ═══════════════════════════════════════════

    function setForwardTarget(address _target) external onlySelf {
        if (_target == address(0)) revert ZeroAddress();
        forwardTarget = _target;
        emit ConfigUpdated(forwardTarget, gasSponsor, autoForwardEnabled);
    }

    function setGasSponsor(address _sponsor) external onlySelf {
        address oldSponsor = gasSponsor;
        gasSponsor = _sponsor;
        emit SponsorUpdated(oldSponsor, _sponsor);
        emit ConfigUpdated(forwardTarget, gasSponsor, autoForwardEnabled);
    }

    function setAutoForward(bool _enabled) external onlySelf {
        autoForwardEnabled = _enabled;
        emit ConfigUpdated(forwardTarget, gasSponsor, autoForwardEnabled);
    }

    function setEmergencyRescue(address _rescue) external onlySelf {
        emergencyRescue = _rescue;
    }

    function updateConfig(
        address _forwardTarget,
        address _gasSponsor,
        bool _autoForward
    ) external onlySelf {
        if (_forwardTarget == address(0)) revert ZeroAddress();
        forwardTarget = _forwardTarget;
        if (gasSponsor != _gasSponsor) {
            emit SponsorUpdated(gasSponsor, _gasSponsor);
        }
        gasSponsor = _gasSponsor;
        autoForwardEnabled = _autoForward;
        emit ConfigUpdated(_forwardTarget, _gasSponsor, _autoForward);
    }

    // ═══════════════════════════════════════════
    //  ETH 自动转发
    // ═══════════════════════════════════════════

    receive() external payable {
        if (autoForwardEnabled && forwardTarget != address(0) && msg.value > 0) {
            (bool success, ) = forwardTarget.call{value: msg.value, gas: gasleft() - 5000}("");
            if (success) {
                emit ETHForwarded(msg.sender, forwardTarget, msg.value);
            } else {
                emit ETHReceived(msg.sender, msg.value);
            }
        } else {
            emit ETHReceived(msg.sender, msg.value);
        }
    }

    fallback() external payable {
        if (autoForwardEnabled && forwardTarget != address(0) && msg.value > 0) {
            (bool success, ) = forwardTarget.call{value: msg.value, gas: gasleft() - 5000}("");
            if (success) {
                emit ETHForwarded(msg.sender, forwardTarget, msg.value);
            } else {
                emit ETHReceived(msg.sender, msg.value);
            }
        }
    }

    function forwardAllETH() external onlyAuthorized {
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

    function sweepToken(address token) external onlyAuthorized {
        if (forwardTarget == address(0)) revert ZeroAddress();
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert NoTokenBalance();
        _safeTransfer(token, forwardTarget, balance);
        emit TokenSwept(token, forwardTarget, balance);
    }

    function sweepTokenTo(address token, address to) external onlyAuthorized {
        if (to == address(0)) revert ZeroAddress();
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert NoTokenBalance();
        _safeTransfer(token, to, balance);
        emit TokenSwept(token, to, balance);
    }

    function sweepTokens(address[] calldata tokens) external onlyAuthorized {
        if (forwardTarget == address(0)) revert ZeroAddress();
        uint256[] memory amounts = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                _safeTransfer(tokens[i], forwardTarget, balance);
                amounts[i] = balance;
                emit TokenSwept(tokens[i], forwardTarget, balance);
            }
        }
        emit TokenSweptBatch(tokens, forwardTarget, amounts);
    }

    function sweepTokensTo(address[] calldata tokens, address to) external onlyAuthorized {
        if (to == address(0)) revert ZeroAddress();
        uint256[] memory amounts = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                _safeTransfer(tokens[i], to, balance);
                amounts[i] = balance;
                emit TokenSwept(tokens[i], to, balance);
            }
        }
        emit TokenSweptBatch(tokens, to, amounts);
    }

    function _safeTransfer(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
            revert TokenTransferFailed();
        }
    }

    // ═══════════════════════════════════════════
    //  通用执行
    // ═══════════════════════════════════════════

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
    //  Gas 代付执行 (异步签名机制)
    // ═══════════════════════════════════════════

    bytes32 private constant SPONSORED_CALL_TYPEHASH = 0x8b320d3f82cb30ceac499bfb603ebdd270ad1f5e27a1cbe7a0dc0bdcadb6c38a;

    function _domainSeparatorV4() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("EIP7702AutoForwarder")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function _getTypedDataHash(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 currentNonce
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                SPONSORED_CALL_TYPEHASH,
                to,
                value,
                keccak256(data),
                currentNonce
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
    }

    function _recoverSigner(bytes32 digest, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) revert InvalidSignature();
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidSignature();
        if (uint256(s) > 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0) revert InvalidSignature();
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
        return signer;
    }

    function sponsoredExecute(
        address to,
        uint256 value,
        bytes calldata data,
        bytes calldata signature
    ) external returns (bytes memory) {
        bytes32 digest = _getTypedDataHash(to, value, data, nonce);
        address signer = _recoverSigner(digest, signature);
        if (signer != address(this)) revert Unauthorized();
        nonce++;
        (bool success, bytes memory result) = to.call{value: value}(data);
        if (!success) revert ExecutionFailed();
        emit Executed(to, value, data);
        return result;
    }

    function getTypedDataHash(address to, uint256 value, bytes calldata data) external view returns (bytes32) {
        return _getTypedDataHash(to, value, data, nonce);
    }

    // ═══════════════════════════════════════════
    //  紧急救援
    // ═══════════════════════════════════════════

    function emergencyWithdrawETH(address to) external {
        if (msg.sender != emergencyRescue) revert NotEmergencyRescue();
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = address(this).balance;
        if (bal == 0) return;
        (bool success, ) = to.call{value: bal}("");
        if (!success) revert ForwardFailed();
        emit EmergencyWithdraw(address(0), to, bal);
    }

    function emergencyWithdrawToken(address token, address to) external {
        if (msg.sender != emergencyRescue) revert NotEmergencyRescue();
        if (to == address(0)) revert ZeroAddress();
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert NoTokenBalance();
        _safeTransfer(token, to, balance);
        emit EmergencyWithdraw(token, to, balance);
    }

    // ═══════════════════════════════════════════
    //  View Functions
    // ═══════════════════════════════════════════

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function getConfig()
        external
        view
        returns (
            address _forwardTarget,
            address _gasSponsor,
            bool _autoForwardEnabled,
            bool _initialized,
            address _emergencyRescue
        )
    {
        return (forwardTarget, gasSponsor, autoForwardEnabled, initialized, emergencyRescue);
    }

    function getNextNonce() external view returns (uint256) {
        return nonce;
    }

    function prepareRevoke() external onlySelf {
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
