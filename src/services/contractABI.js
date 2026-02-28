// EIP-7702 Contract Registry
// Each entry: { id, name, description, compiler, evmTarget, abi, bytecode, features }

const EIP7702_AUTO_FORWARDER_ABI = [
    {
        "inputs": [],
        "name": "AlreadyInitialized",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "ExecutionFailed",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "ForwardFailed",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "LengthMismatch",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "NoTokenBalance",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "TokenTransferFailed",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "Unauthorized",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "ZeroAddress",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "forwardTarget",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "gasSponsor",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "bool",
                "name": "autoForward",
                "type": "bool"
            }
        ],
        "name": "ConfigUpdated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "ETHForwarded",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "ETHReceived",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "bytes",
                "name": "data",
                "type": "bytes"
            }
        ],
        "name": "Executed",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "forwardTarget",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "gasSponsor",
                "type": "address"
            }
        ],
        "name": "Initialized",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "TokenSwept",
        "type": "event"
    },
    {
        "stateMutability": "payable",
        "type": "fallback"
    },
    {
        "inputs": [],
        "name": "autoForwardEnabled",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            },
            {
                "internalType": "bytes",
                "name": "data",
                "type": "bytes"
            }
        ],
        "name": "execute",
        "outputs": [
            {
                "internalType": "bytes",
                "name": "",
                "type": "bytes"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address[]",
                "name": "targets",
                "type": "address[]"
            },
            {
                "internalType": "uint256[]",
                "name": "values",
                "type": "uint256[]"
            },
            {
                "internalType": "bytes[]",
                "name": "calldatas",
                "type": "bytes[]"
            }
        ],
        "name": "executeBatch",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "forwardAllETH",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "forwardTarget",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "gasSponsor",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getBalance",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getConfig",
        "outputs": [
            {
                "internalType": "address",
                "name": "_forwardTarget",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "_gasSponsor",
                "type": "address"
            },
            {
                "internalType": "bool",
                "name": "_autoForwardEnabled",
                "type": "bool"
            },
            {
                "internalType": "bool",
                "name": "_initialized",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            }
        ],
        "name": "getTokenBalance",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_forwardTarget",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "_gasSponsor",
                "type": "address"
            },
            {
                "internalType": "bool",
                "name": "_autoForward",
                "type": "bool"
            }
        ],
        "name": "initialize",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "initialized",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "nonce",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "prepareRevoke",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bool",
                "name": "_enabled",
                "type": "bool"
            }
        ],
        "name": "setAutoForward",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_target",
                "type": "address"
            }
        ],
        "name": "setForwardTarget",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_sponsor",
                "type": "address"
            }
        ],
        "name": "setGasSponsor",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            }
        ],
        "name": "sweepToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address[]",
                "name": "tokens",
                "type": "address[]"
            }
        ],
        "name": "sweepTokens",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_forwardTarget",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "_gasSponsor",
                "type": "address"
            },
            {
                "internalType": "bool",
                "name": "_autoForward",
                "type": "bool"
            }
        ],
        "name": "updateConfig",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "stateMutability": "payable",
        "type": "receive"
    }
];

const EIP7702_AUTO_FORWARDER_BYTECODE = "0x6080604052348015600e575f5ffd5b5061160a8061001c5f395ff3fe608060405260043610610117575f3560e01c80636d3e44811161009f578063affed0e011610063578063affed0e01461048a578063b425ef831461049f578063b61d27f6146104b3578063c3f909d4146104df578063e4bbb5a8146105355761023c565b80636d3e4481146103e35780636edfcd23146103f757806376405b931461042e578063909b19d91461044d578063a94cc1a01461046c5761023c565b806337a9ba94116100e657806337a9ba94146103485780633aecd0e31461036757806347d5e3ae1461038657806347e1da2a146103a5578063537244c6146103c45761023c565b806312065fe0146102b8578063158ef93e146102d95780631be195601461030957806332737034146103285761023c565b3661023c57600154600160a01b900460ff16801561013e57505f546001600160a01b031615155b801561014957505f34115b15610204575f80546040516001600160a01b039091169034908381818185875af1925050503d805f8114610198576040519150601f19603f3d011682016040523d82523d5f602084013e61019d565b606091505b50509050806101bf5760405163096dc0e160e01b815260040160405180910390fd5b5f546040513481526001600160a01b039091169033907fba3e71c2881efe881d169a722215ae66587e85bf64bcc507f2904a7345afeba09060200160405180910390a3005b60405134815233907fbfe611b001dfcd411432f7bf0d79b82b4b2ee81511edac123a3403c357fb972a9060200160405180910390a25b005b600154600160a01b900460ff16801561025e57505f546001600160a01b031615155b801561026957505f34115b1561023a575f80546040516001600160a01b039091169034908381818185875af1925050503d805f8114610198576040519150601f19603f3d011682016040523d82523d5f602084013e61019d565b3480156102c3575f5ffd5b50475b6040519081526020015b60405180910390f35b3480156102e4575f5ffd5b506001546102f990600160a81b900460ff1681565b60405190151581526020016102d0565b348015610314575f5ffd5b5061023a61032336600461127a565b610554565b348015610333575f5ffd5b506001546102f990600160a01b900460ff1681565b348015610353575f5ffd5b5061023a6103623660046112aa565b610728565b348015610372575f5ffd5b506102c661038136600461127a565b6107de565b348015610391575f5ffd5b5061023a6103a036600461127a565b61084c565b3480156103b0575f5ffd5b5061023a6103bf366004611336565b6108d0565b3480156103cf575f5ffd5b5061023a6103de36600461127a565b610acb565b3480156103ee575f5ffd5b5061023a610b6b565b348015610402575f5ffd5b50600154610416906001600160a01b031681565b6040516001600160a01b0390911681526020016102d0565b348015610439575f5ffd5b5061023a6104483660046113d5565b610c9c565b348015610458575f5ffd5b5061023a6104673660046113f0565b610d22565b348015610477575f5ffd5b505f54610416906001600160a01b031681565b348015610495575f5ffd5b506102c660025481565b3480156104aa575f5ffd5b5061023a610f6e565b3480156104be575f5ffd5b506104d26104cd36600461142f565b611069565b6040516102d091906114b2565b3480156104ea575f5ffd5b505f54600154604080516001600160a01b039384168152928216602084015260ff600160a01b83048116151591840191909152600160a81b90910416151560608201526080016102d0565b348015610540575f5ffd5b5061023a61054f3660046112aa565b611166565b33301480159061056f57506001546001600160a01b03163314155b801561057b5750333214155b15610598576040516282b42960e81b815260040160405180910390fd5b5f546001600160a01b03166105c05760405163d92e233d60e01b815260040160405180910390fd5b6040516370a0823160e01b81523060048201525f906001600160a01b038316906370a0823190602401602060405180830381865afa158015610604573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061062891906114e7565b9050805f0361064a57604051633dbd9b6d60e11b815260040160405180910390fd5b5f805460405163a9059cbb60e01b81526001600160a01b039182166004820152602481018490529084169063a9059cbb906044016020604051808303815f875af115801561069a573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906106be91906114fe565b9050806106de5760405163022e258160e11b815260040160405180910390fd5b5f546040518381526001600160a01b03918216918516907f115d7b5114b5954762cc233b141a7c777a8f79d93f50af7216d645c87fb4883e906020015b60405180910390a3505050565b3330148015906107385750333214155b15610755576040516282b42960e81b815260040160405180910390fd5b6001600160a01b03831661077c5760405163d92e233d60e01b815260040160405180910390fd5b5f80546001600160a01b038086166001600160a01b0319909216821790925560018054841515600160a01b026001600160a81b03199091169386169384171790556040515f5160206115b55f395f51905f529061071b90851515815260200190565b6040516370a0823160e01b81523060048201525f906001600160a01b038316906370a0823190602401602060405180830381865afa158015610822573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061084691906114e7565b92915050565b33301480159061085c5750333214155b15610879576040516282b42960e81b815260040160405180910390fd5b600180546001600160a01b0319166001600160a01b03838116918217928390555f54604051600160a01b90940460ff161515845291929116905f5160206115b55f395f51905f52906020015b60405180910390a350565b3330148015906108e05750333214155b156108fd576040516282b42960e81b815260040160405180910390fd5b848314158061090c5750828114155b1561092d576040516001621398b960e31b0319815260040160405180910390fd5b5f5b85811015610ac2575f87878381811061094a5761094a611519565b905060200201602081019061095f919061127a565b6001600160a01b031686868481811061097a5761097a611519565b9050602002013585858581811061099357610993611519565b90506020028101906109a5919061152d565b6040516109b3929190611570565b5f6040518083038185875af1925050503d805f81146109ed576040519150601f19603f3d011682016040523d82523d5f602084013e6109f2565b606091505b5050905080610a1457604051632b3f6d1160e21b815260040160405180910390fd5b878783818110610a2657610a26611519565b9050602002016020810190610a3b919061127a565b6001600160a01b03167fcaf938de11c367272220bfd1d2baa99ca46665e7bc4d85f00adb51b90fe1fa9f878785818110610a7757610a77611519565b90506020020135868686818110610a9057610a90611519565b9050602002810190610aa2919061152d565b604051610ab19392919061157f565b60405180910390a25060010161092f565b50505050505050565b333014801590610adb5750333214155b15610af8576040516282b42960e81b815260040160405180910390fd5b6001600160a01b038116610b1f5760405163d92e233d60e01b815260040160405180910390fd5b5f80546001600160a01b0319166001600160a01b03838116918217909255600154604051600160a01b820460ff16151581529216915f5160206115b55f395f51905f52906020016108c5565b333014801590610b8657506001546001600160a01b03163314155b8015610b925750333214155b15610baf576040516282b42960e81b815260040160405180910390fd5b5f546001600160a01b0316610bd75760405163d92e233d60e01b815260040160405180910390fd5b475f819003610be35750565b5f80546040516001600160a01b039091169083908381818185875af1925050503d805f8114610c2d576040519150601f19603f3d011682016040523d82523d5f602084013e610c32565b606091505b5050905080610c545760405163096dc0e160e01b815260040160405180910390fd5b5f546040518381526001600160a01b039091169030907fba3e71c2881efe881d169a722215ae66587e85bf64bcc507f2904a7345afeba09060200160405180910390a350505b565b333014801590610cac5750333214155b15610cc9576040516282b42960e81b815260040160405180910390fd5b60018054821515600160a01b90810260ff60a01b1983168117938490555f546040516001600160a01b0392831694831694909417949116925f5160206115b55f395f51905f52926108c5920460ff161515815260200190565b333014801590610d3d57506001546001600160a01b03163314155b8015610d495750333214155b15610d66576040516282b42960e81b815260040160405180910390fd5b5f546001600160a01b0316610d8e5760405163d92e233d60e01b815260040160405180910390fd5b5f5b81811015610f69575f838383818110610dab57610dab611519565b9050602002016020810190610dc0919061127a565b6040516370a0823160e01b81523060048201526001600160a01b0391909116906370a0823190602401602060405180830381865afa158015610e04573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610e2891906114e7565b90508015610f60575f848484818110610e4357610e43611519565b9050602002016020810190610e58919061127a565b5f5460405163a9059cbb60e01b81526001600160a01b0391821660048201526024810185905291169063a9059cbb906044016020604051808303815f875af1158015610ea6573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610eca91906114fe565b905080610eea5760405163022e258160e11b815260040160405180910390fd5b5f546001600160a01b0316858585818110610f0757610f07611519565b9050602002016020810190610f1c919061127a565b6001600160a01b03167f115d7b5114b5954762cc233b141a7c777a8f79d93f50af7216d645c87fb4883e84604051610f5691815260200190565b60405180910390a3505b50600101610d90565b505050565b333014801590610f7e5750333214155b15610f9b576040516282b42960e81b815260040160405180910390fd5b5f546001600160a01b031615801590610fb357505f47115b15610c9a575f80546040516001600160a01b039091169047908381818185875af1925050503d805f8114611002576040519150601f19603f3d011682016040523d82523d5f602084013e611007565b606091505b50509050806110295760405163096dc0e160e01b815260040160405180910390fd5b5f546040514781526001600160a01b039091169030907fba3e71c2881efe881d169a722215ae66587e85bf64bcc507f2904a7345afeba0906020016108c5565b606033301480159061107b5750333214155b15611098576040516282b42960e81b815260040160405180910390fd5b5f5f866001600160a01b03168686866040516110b5929190611570565b5f6040518083038185875af1925050503d805f81146110ef576040519150601f19603f3d011682016040523d82523d5f602084013e6110f4565b606091505b50915091508161111757604051632b3f6d1160e21b815260040160405180910390fd5b866001600160a01b03167fcaf938de11c367272220bfd1d2baa99ca46665e7bc4d85f00adb51b90fe1fa9f8787876040516111549392919061157f565b60405180910390a29695505050505050565b3330148015906111765750333214155b15611193576040516282b42960e81b815260040160405180910390fd5b600154600160a81b900460ff16156111bd5760405162dc149f60e41b815260040160405180910390fd5b6001600160a01b0383166111e45760405163d92e233d60e01b815260040160405180910390fd5b5f80546001600160a01b0319166001600160a01b03858116918217835560018054600160a81b9287166001600160a81b03199091168117600160a01b871515021760ff60a81b191692909217905560405190927f3cd5ec01b1ae7cfec6ca1863e2cd6aa25d6d1702825803ff2b7cc95010fffdc291a3505050565b80356001600160a01b0381168114611275575f5ffd5b919050565b5f6020828403121561128a575f5ffd5b6112938261125f565b9392505050565b80151581146112a7575f5ffd5b50565b5f5f5f606084860312156112bc575f5ffd5b6112c58461125f565b92506112d36020850161125f565b915060408401356112e38161129a565b809150509250925092565b5f5f83601f8401126112fe575f5ffd5b50813567ffffffffffffffff811115611315575f5ffd5b6020830191508360208260051b850101111561132f575f5ffd5b9250929050565b5f5f5f5f5f5f6060878903121561134b575f5ffd5b863567ffffffffffffffff811115611361575f5ffd5b61136d89828a016112ee565b909750955050602087013567ffffffffffffffff81111561138c575f5ffd5b61139889828a016112ee565b909550935050604087013567ffffffffffffffff8111156113b7575f5ffd5b6113c389828a016112ee565b979a9699509497509295939492505050565b5f602082840312156113e5575f5ffd5b81356112938161129a565b5f5f60208385031215611401575f5ffd5b823567ffffffffffffffff811115611417575f5ffd5b611423858286016112ee565b90969095509350505050565b5f5f5f5f60608587031215611442575f5ffd5b61144b8561125f565b935060208501359250604085013567ffffffffffffffff81111561146d575f5ffd5b8501601f8101871361147d575f5ffd5b803567ffffffffffffffff811115611493575f5ffd5b8760208284010111156114a4575f5ffd5b949793965060200194505050565b602081525f82518060208401528060208501604085015e5f604082850101526040601f19601f83011684010191505092915050565b5f602082840312156114f7575f5ffd5b5051919050565b5f6020828403121561150e575f5ffd5b81516112938161129a565b634e487b7160e01b5f52603260045260245ffd5b5f5f8335601e19843603018112611542575f5ffd5b83018035915067ffffffffffffffff82111561155c575f5ffd5b60200191503681900382131561132f575f5ffd5b818382375f9101908152919050565b83815260406020820152816040820152818360608301375f818301606090810191909152601f909201601f191601019291505056fe8f77097880cbeed821b47f9836e06b28a74d72de99667426584d993fe4f56e80a2646970667358221220bcb2a897121df7204937785a379246e06485c562401a2f316bdb520167361b9464736f6c634300081b0033";

/**
 * Contract Registry — 可在此扩展更多合约
 */
export const CONTRACT_REGISTRY = [
    {
        id: 'eip7702-auto-forwarder',
        name: 'EIP7702AutoForwarder',
        description: 'Auto-forward ETH & sweep ERC20, gas sponsorship via EIP-7702 native mechanism',
        compiler: 'Solidity 0.8.27',
        evmTarget: 'Cancun',
        features: [
            'deploy.featureAutoForward',
            'deploy.featureERC20Sweep',
            'deploy.featureGasSponsor',
            'deploy.featureBatchExec',
        ],
        abi: EIP7702_AUTO_FORWARDER_ABI,
        bytecode: EIP7702_AUTO_FORWARDER_BYTECODE,
    },
];

// Backward compatible exports
export const CONTRACT_ABI = EIP7702_AUTO_FORWARDER_ABI;
export const CONTRACT_BYTECODE = EIP7702_AUTO_FORWARDER_BYTECODE;
export const CONTRACT_NAME = "EIP7702AutoForwarder";
