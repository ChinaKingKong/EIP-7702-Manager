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
            },
            {
                "internalType": "bytes",
                "name": "signature",
                "type": "bytes"
            }
        ],
        "name": "sponsoredExecute",
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

const EIP7702_AUTO_FORWARDER_BYTECODE = "0x6080604052348015600e575f5ffd5b50611b348061001c5f395ff3fe608060405260043610610122575f3560e01c80636edfcd231161009f578063affed0e011610063578063affed0e0146104c1578063b425ef83146104d6578063b61d27f6146104ea578063c3f909d414610509578063e4bbb5a81461055f57610247565b80636edfcd231461040257806376405b9314610439578063909b19d9146104585780639463f7a614610477578063a94cc1a0146104a357610247565b80633aecd0e3116100e65780633aecd0e31461037257806347d5e3ae1461039157806347e1da2a146103b0578063537244c6146103cf5780636d3e4481146103ee57610247565b806312065fe0146102c3578063158ef93e146102e45780631be1956014610314578063327370341461033357806337a9ba941461035357610247565b3661024757600154600160a01b900460ff16801561014957505f546001600160a01b031615155b801561015457505f34115b1561020f575f80546040516001600160a01b039091169034908381818185875af1925050503d805f81146101a3576040519150601f19603f3d011682016040523d82523d5f602084013e6101a8565b606091505b50509050806101ca5760405163096dc0e160e01b815260040160405180910390fd5b5f546040513481526001600160a01b039091169033907fba3e71c2881efe881d169a722215ae66587e85bf64bcc507f2904a7345afeba09060200160405180910390a3005b60405134815233907fbfe611b001dfcd411432f7bf0d79b82b4b2ee81511edac123a3403c357fb972a9060200160405180910390a25b005b600154600160a01b900460ff16801561026957505f546001600160a01b031615155b801561027457505f34115b15610245575f80546040516001600160a01b039091169034908381818185875af1925050503d805f81146101a3576040519150601f19603f3d011682016040523d82523d5f602084013e6101a8565b3480156102ce575f5ffd5b50475b6040519081526020015b60405180910390f35b3480156102ef575f5ffd5b5060015461030490600160a81b900460ff1681565b60405190151581526020016102db565b34801561031f575f5ffd5b5061024561032e3660046116d7565b61057e565b34801561033e575f5ffd5b5060015461030490600160a01b900460ff1681565b34801561035e575f5ffd5b5061024561036d366004611707565b610752565b34801561037d575f5ffd5b506102d161038c3660046116d7565b610808565b34801561039c575f5ffd5b506102456103ab3660046116d7565b610876565b3480156103bb575f5ffd5b506102456103ca366004611793565b6108fa565b3480156103da575f5ffd5b506102456103e93660046116d7565b610af5565b3480156103f9575f5ffd5b50610245610b95565b34801561040d575f5ffd5b50600154610421906001600160a01b031681565b6040516001600160a01b0390911681526020016102db565b348015610444575f5ffd5b50610245610453366004611832565b610cc6565b348015610463575f5ffd5b5061024561047236600461184d565b610d4c565b348015610482575f5ffd5b506104966104913660046118ca565b610f98565b6040516102db9190611941565b3480156104ae575f5ffd5b505f54610421906001600160a01b031681565b3480156104cc575f5ffd5b506102d160025481565b3480156104e1575f5ffd5b50610245611290565b3480156104f5575f5ffd5b50610496610504366004611976565b61138b565b348015610514575f5ffd5b505f54600154604080516001600160a01b039384168152928216602084015260ff600160a01b83048116151591840191909152600160a81b90910416151560608201526080016102db565b34801561056a575f5ffd5b50610245610579366004611707565b611488565b33301480159061059957506001546001600160a01b03163314155b80156105a55750333214155b156105c2576040516282b42960e81b815260040160405180910390fd5b5f546001600160a01b03166105ea5760405163d92e233d60e01b815260040160405180910390fd5b6040516370a0823160e01b81523060048201525f906001600160a01b038316906370a0823190602401602060405180830381865afa15801561062e573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061065291906119cc565b9050805f0361067457604051633dbd9b6d60e11b815260040160405180910390fd5b5f805460405163a9059cbb60e01b81526001600160a01b039182166004820152602481018490529084169063a9059cbb906044016020604051808303815f875af11580156106c4573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906106e891906119e3565b9050806107085760405163022e258160e11b815260040160405180910390fd5b5f546040518381526001600160a01b03918216918516907f115d7b5114b5954762cc233b141a7c777a8f79d93f50af7216d645c87fb4883e906020015b60405180910390a3505050565b3330148015906107625750333214155b1561077f576040516282b42960e81b815260040160405180910390fd5b6001600160a01b0383166107a65760405163d92e233d60e01b815260040160405180910390fd5b5f80546001600160a01b038086166001600160a01b0319909216821790925560018054841515600160a01b026001600160a81b03199091169386169384171790556040515f516020611adf5f395f51905f529061074590851515815260200190565b6040516370a0823160e01b81523060048201525f906001600160a01b038316906370a0823190602401602060405180830381865afa15801561084c573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061087091906119cc565b92915050565b3330148015906108865750333214155b156108a3576040516282b42960e81b815260040160405180910390fd5b600180546001600160a01b0319166001600160a01b03838116918217928390555f54604051600160a01b90940460ff161515845291929116905f516020611adf5f395f51905f52906020015b60405180910390a350565b33301480159061090a5750333214155b15610927576040516282b42960e81b815260040160405180910390fd5b84831415806109365750828114155b15610957576040516001621398b960e31b0319815260040160405180910390fd5b5f5b85811015610aec575f878783818110610974576109746119fe565b905060200201602081019061098991906116d7565b6001600160a01b03168686848181106109a4576109a46119fe565b905060200201358585858181106109bd576109bd6119fe565b90506020028101906109cf9190611a12565b6040516109dd929190611a55565b5f6040518083038185875af1925050503d805f8114610a17576040519150601f19603f3d011682016040523d82523d5f602084013e610a1c565b606091505b5050905080610a3e57604051632b3f6d1160e21b815260040160405180910390fd5b878783818110610a5057610a506119fe565b9050602002016020810190610a6591906116d7565b6001600160a01b03167fcaf938de11c367272220bfd1d2baa99ca46665e7bc4d85f00adb51b90fe1fa9f878785818110610aa157610aa16119fe565b90506020020135868686818110610aba57610aba6119fe565b9050602002810190610acc9190611a12565b604051610adb93929190611a64565b60405180910390a250600101610959565b50505050505050565b333014801590610b055750333214155b15610b22576040516282b42960e81b815260040160405180910390fd5b6001600160a01b038116610b495760405163d92e233d60e01b815260040160405180910390fd5b5f80546001600160a01b0319166001600160a01b03838116918217909255600154604051600160a01b820460ff16151581529216915f516020611adf5f395f51905f52906020016108ef565b333014801590610bb057506001546001600160a01b03163314155b8015610bbc5750333214155b15610bd9576040516282b42960e81b815260040160405180910390fd5b5f546001600160a01b0316610c015760405163d92e233d60e01b815260040160405180910390fd5b475f819003610c0d5750565b5f80546040516001600160a01b039091169083908381818185875af1925050503d805f8114610c57576040519150601f19603f3d011682016040523d82523d5f602084013e610c5c565b606091505b5050905080610c7e5760405163096dc0e160e01b815260040160405180910390fd5b5f546040518381526001600160a01b039091169030907fba3e71c2881efe881d169a722215ae66587e85bf64bcc507f2904a7345afeba09060200160405180910390a350505b565b333014801590610cd65750333214155b15610cf3576040516282b42960e81b815260040160405180910390fd5b60018054821515600160a01b90810260ff60a01b1983168117938490555f546040516001600160a01b0392831694831694909417949116925f516020611adf5f395f51905f52926108ef920460ff161515815260200190565b333014801590610d6757506001546001600160a01b03163314155b8015610d735750333214155b15610d90576040516282b42960e81b815260040160405180910390fd5b5f546001600160a01b0316610db85760405163d92e233d60e01b815260040160405180910390fd5b5f5b81811015610f93575f838383818110610dd557610dd56119fe565b9050602002016020810190610dea91906116d7565b6040516370a0823160e01b81523060048201526001600160a01b0391909116906370a0823190602401602060405180830381865afa158015610e2e573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610e5291906119cc565b90508015610f8a575f848484818110610e6d57610e6d6119fe565b9050602002016020810190610e8291906116d7565b5f5460405163a9059cbb60e01b81526001600160a01b0391821660048201526024810185905291169063a9059cbb906044016020604051808303815f875af1158015610ed0573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610ef491906119e3565b905080610f145760405163022e258160e11b815260040160405180910390fd5b5f546001600160a01b0316858585818110610f3157610f316119fe565b9050602002016020810190610f4691906116d7565b6001600160a01b03167f115d7b5114b5954762cc233b141a7c777a8f79d93f50af7216d645c87fb4883e84604051610f8091815260200190565b60405180910390a3505b50600101610dba565b505050565b60605f7f8b320d3f82cb30ceac499bfb603ebdd270ad1f5e27a1cbe7a0dc0bdcadb6c38a5f1b88888888604051610fd0929190611a55565b604051908190038120600254611012959493926020019485526001600160a01b0393909316602085015260408401919091526060830152608082015260a00190565b6040516020818303038152906040528051906020012090505f611109604080518082018252601481527322a4a81b9b981920baba37a337b93bb0b93232b960611b6020918201528151808301835260018152603160f81b9082015281517f8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f818301527f7ef4872878b04ee4262301fdfc75f3b60aa572501746f630bab1db203d799002818401527fc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc660608201524660808201523060a0808301919091528351808303909101815260c0909101909252815191012090565b60405161190160f01b60208201526022810191909152604281018390526062016040516020818303038152906040528051906020012090505f6111818287878080601f0160208091040260200160405190810160405280939291908181526020018383808284375f9201919091525061158192505050565b90506001600160a01b0381166111a9576040516282b42960e81b815260040160405180910390fd5b60028054905f6111b883611aad565b91905055505f5f8b6001600160a01b03168b8b8b6040516111da929190611a55565b5f6040518083038185875af1925050503d805f8114611214576040519150601f19603f3d011682016040523d82523d5f602084013e611219565b606091505b50915091508161123c57604051632b3f6d1160e21b815260040160405180910390fd5b8b6001600160a01b03167fcaf938de11c367272220bfd1d2baa99ca46665e7bc4d85f00adb51b90fe1fa9f8c8c8c60405161127993929190611a64565b60405180910390a29b9a5050505050505050505050565b3330148015906112a05750333214155b156112bd576040516282b42960e81b815260040160405180910390fd5b5f546001600160a01b0316158015906112d557505f47115b15610cc4575f80546040516001600160a01b039091169047908381818185875af1925050503d805f8114611324576040519150601f19603f3d011682016040523d82523d5f602084013e611329565b606091505b505090508061134b5760405163096dc0e160e01b815260040160405180910390fd5b5f546040514781526001600160a01b039091169030907fba3e71c2881efe881d169a722215ae66587e85bf64bcc507f2904a7345afeba0906020016108ef565b606033301480159061139d5750333214155b156113ba576040516282b42960e81b815260040160405180910390fd5b5f5f866001600160a01b03168686866040516113d7929190611a55565b5f6040518083038185875af1925050503d805f8114611411576040519150601f19603f3d011682016040523d82523d5f602084013e611416565b606091505b50915091508161143957604051632b3f6d1160e21b815260040160405180910390fd5b866001600160a01b03167fcaf938de11c367272220bfd1d2baa99ca46665e7bc4d85f00adb51b90fe1fa9f87878760405161147693929190611a64565b60405180910390a29695505050505050565b3330148015906114985750333214155b156114b5576040516282b42960e81b815260040160405180910390fd5b600154600160a81b900460ff16156114df5760405162dc149f60e41b815260040160405180910390fd5b6001600160a01b0383166115065760405163d92e233d60e01b815260040160405180910390fd5b5f80546001600160a01b0319166001600160a01b03858116918217835560018054600160a81b9287166001600160a81b03199091168117600160a01b871515021760ff60a81b191692909217905560405190927f3cd5ec01b1ae7cfec6ca1863e2cd6aa25d6d1702825803ff2b7cc95010fffdc291a3505050565b5f81516041146115d85760405162461bcd60e51b815260206004820152601860248201527f496e76616c6964207369676e6174757265206c656e677468000000000000000060448201526064015b60405180910390fd5b6020820151604083015160608401515f1a601b811015611600576115fd601b82611ac5565b90505b8060ff16601b1415801561161857508060ff16601c14155b156116575760405162461bcd60e51b815260206004820152600f60248201526e496e76616c696420762076616c756560881b60448201526064016115cf565b604080515f81526020810180835288905260ff831691810191909152606081018490526080810183905260019060a0016020604051602081039080840390855afa1580156116a7573d5f5f3e3d5ffd5b5050604051601f190151979650505050505050565b80356001600160a01b03811681146116d2575f5ffd5b919050565b5f602082840312156116e7575f5ffd5b6116f0826116bc565b9392505050565b8015158114611704575f5ffd5b50565b5f5f5f60608486031215611719575f5ffd5b611722846116bc565b9250611730602085016116bc565b91506040840135611740816116f7565b809150509250925092565b5f5f83601f84011261175b575f5ffd5b50813567ffffffffffffffff811115611772575f5ffd5b6020830191508360208260051b850101111561178c575f5ffd5b9250929050565b5f5f5f5f5f5f606087890312156117a8575f5ffd5b863567ffffffffffffffff8111156117be575f5ffd5b6117ca89828a0161174b565b909750955050602087013567ffffffffffffffff8111156117e9575f5ffd5b6117f589828a0161174b565b909550935050604087013567ffffffffffffffff811115611814575f5ffd5b61182089828a0161174b565b979a9699509497509295939492505050565b5f60208284031215611842575f5ffd5b81356116f0816116f7565b5f5f6020838503121561185e575f5ffd5b823567ffffffffffffffff811115611874575f5ffd5b6118808582860161174b565b90969095509350505050565b5f5f83601f84011261189c575f5ffd5b50813567ffffffffffffffff8111156118b3575f5ffd5b60208301915083602082850101111561178c575f5ffd5b5f5f5f5f5f5f608087890312156118df575f5ffd5b6118e8876116bc565b955060208701359450604087013567ffffffffffffffff81111561190a575f5ffd5b61191689828a0161188c565b909550935050606087013567ffffffffffffffff811115611935575f5ffd5b61182089828a0161188c565b602081525f82518060208401528060208501604085015e5f604082850101526040601f19601f83011684010191505092915050565b5f5f5f5f60608587031215611989575f5ffd5b611992856116bc565b935060208501359250604085013567ffffffffffffffff8111156119b4575f5ffd5b6119c08782880161188c565b95989497509550505050565b5f602082840312156119dc575f5ffd5b5051919050565b5f602082840312156119f3575f5ffd5b81516116f0816116f7565b634e487b7160e01b5f52603260045260245ffd5b5f5f8335601e19843603018112611a27575f5ffd5b83018035915067ffffffffffffffff821115611a41575f5ffd5b60200191503681900382131561178c575f5ffd5b818382375f9101908152919050565b83815260406020820152816040820152818360608301375f818301606090810191909152601f909201601f1916010192915050565b634e487b7160e01b5f52601160045260245ffd5b5f60018201611abe57611abe611a99565b5060010190565b60ff818116838216019081111561087057610870611a9956fe8f77097880cbeed821b47f9836e06b28a74d72de99667426584d993fe4f56e80a2646970667358221220038fb0b8575552c129f19685ff1d4ba7fbbb9a8cc220e113cc5ce60c0e600f0264736f6c634300081b0033";

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
