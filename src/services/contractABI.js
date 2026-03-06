export const EIP7702_AUTO_FORWARDER_ABI = [
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
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            }
        ],
        "name": "sweepTokenTo",
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
                "internalType": "address[]",
                "name": "tokens",
                "type": "address[]"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            }
        ],
        "name": "sweepTokensTo",
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

const EIP7702_AUTO_FORWARDER_BYTECODE = "0x6080604052348015600e575f5ffd5b50611ee88061001c5f395ff3fe608060405260043610610138575f3560e01c806375e68502116100aa578063affed0e01161006e578063affed0e0146104f6578063b425ef831461050b578063b61d27f61461051f578063c3f909d41461053e578063e4bbb5a814610594578063ef44de42146105b35761025d565b806375e685021461044f57806376405b931461046e578063909b19d91461048d5780639463f7a6146104ac578063a94cc1a0146104d85761025d565b80633aecd0e3116100fc5780633aecd0e31461038857806347d5e3ae146103a757806347e1da2a146103c6578063537244c6146103e55780636d3e4481146104045780636edfcd23146104185761025d565b806312065fe0146102d9578063158ef93e146102fa5780631be195601461032a578063327370341461034957806337a9ba94146103695761025d565b3661025d57600154600160a01b900460ff16801561015f57505f546001600160a01b031615155b801561016a57505f34115b15610225575f80546040516001600160a01b039091169034908381818185875af1925050503d805f81146101b9576040519150601f19603f3d011682016040523d82523d5f602084013e6101be565b606091505b50509050806101e05760405163096dc0e160e01b815260040160405180910390fd5b5f546040513481526001600160a01b039091169033907fba3e71c2881efe881d169a722215ae66587e85bf64bcc507f2904a7345afeba09060200160405180910390a3005b60405134815233907fbfe611b001dfcd411432f7bf0d79b82b4b2ee81511edac123a3403c357fb972a9060200160405180910390a25b005b600154600160a01b900460ff16801561027f57505f546001600160a01b031615155b801561028a57505f34115b1561025b575f80546040516001600160a01b039091169034908381818185875af1925050503d805f81146101b9576040519150601f19603f3d011682016040523d82523d5f602084013e6101be565b3480156102e4575f5ffd5b50475b6040519081526020015b60405180910390f35b348015610305575f5ffd5b5060015461031a90600160a81b900460ff1681565b60405190151581526020016102f1565b348015610335575f5ffd5b5061025b6103443660046119d4565b6105d2565b348015610354575f5ffd5b5060015461031a90600160a01b900460ff1681565b348015610374575f5ffd5b5061025b610383366004611a04565b610715565b348015610393575f5ffd5b506102e76103a23660046119d4565b6107d8565b3480156103b2575f5ffd5b5061025b6103c13660046119d4565b610846565b3480156103d1575f5ffd5b5061025b6103e0366004611a90565b6108ca565b3480156103f0575f5ffd5b5061025b6103ff3660046119d4565b610ac5565b34801561040f575f5ffd5b5061025b610b65565b348015610423575f5ffd5b50600154610437906001600160a01b031681565b6040516001600160a01b0390911681526020016102f1565b34801561045a575f5ffd5b5061025b610469366004611b2f565b610c90565b348015610479575f5ffd5b5061025b610488366004611b60565b610dc2565b348015610498575f5ffd5b5061025b6104a7366004611b7b565b610e48565b3480156104b7575f5ffd5b506104cb6104c6366004611bf8565b611001565b6040516102f19190611c6f565b3480156104e3575f5ffd5b505f54610437906001600160a01b031681565b348015610501575f5ffd5b506102e760025481565b348015610516575f5ffd5b5061025b6112f3565b34801561052a575f5ffd5b506104cb610539366004611ca4565b6113ee565b348015610549575f5ffd5b505f54600154604080516001600160a01b039384168152928216602084015260ff600160a01b83048116151591840191909152600160a81b90910416151560608201526080016102f1565b34801561059f575f5ffd5b5061025b6105ae366004611a04565b6114eb565b3480156105be575f5ffd5b5061025b6105cd366004611cfa565b6115e4565b3330148015906105ed57506001546001600160a01b03163314155b80156105f95750333214155b15610616576040516282b42960e81b815260040160405180910390fd5b5f546001600160a01b031661063e5760405163d92e233d60e01b815260040160405180910390fd5b6040516370a0823160e01b81523060048201525f906001600160a01b038316906370a0823190602401602060405180830381865afa158015610682573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906106a69190611d4a565b9050805f036106c857604051633dbd9b6d60e11b815260040160405180910390fd5b5f546106df9083906001600160a01b031683611792565b5f546040518281526001600160a01b03918216918416905f516020611e735f395f51905f52906020015b60405180910390a35050565b3330148015906107255750333214155b15610742576040516282b42960e81b815260040160405180910390fd5b6001600160a01b0383166107695760405163d92e233d60e01b815260040160405180910390fd5b5f80546001600160a01b038086166001600160a01b0319909216821790925560018054841515600160a01b026001600160a81b03199091169386169384171790556040515f516020611e935f395f51905f52906107cb90851515815260200190565b60405180910390a3505050565b6040516370a0823160e01b81523060048201525f906001600160a01b038316906370a0823190602401602060405180830381865afa15801561081c573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906108409190611d4a565b92915050565b3330148015906108565750333214155b15610873576040516282b42960e81b815260040160405180910390fd5b600180546001600160a01b0319166001600160a01b03838116918217928390555f54604051600160a01b90940460ff161515845291929116905f516020611e935f395f51905f52906020015b60405180910390a350565b3330148015906108da5750333214155b156108f7576040516282b42960e81b815260040160405180910390fd5b84831415806109065750828114155b15610927576040516001621398b960e31b0319815260040160405180910390fd5b5f5b85811015610abc575f87878381811061094457610944611d61565b905060200201602081019061095991906119d4565b6001600160a01b031686868481811061097457610974611d61565b9050602002013585858581811061098d5761098d611d61565b905060200281019061099f9190611d75565b6040516109ad929190611db8565b5f6040518083038185875af1925050503d805f81146109e7576040519150601f19603f3d011682016040523d82523d5f602084013e6109ec565b606091505b5050905080610a0e57604051632b3f6d1160e21b815260040160405180910390fd5b878783818110610a2057610a20611d61565b9050602002016020810190610a3591906119d4565b6001600160a01b03167fcaf938de11c367272220bfd1d2baa99ca46665e7bc4d85f00adb51b90fe1fa9f878785818110610a7157610a71611d61565b90506020020135868686818110610a8a57610a8a611d61565b9050602002810190610a9c9190611d75565b604051610aab93929190611dc7565b60405180910390a250600101610929565b50505050505050565b333014801590610ad55750333214155b15610af2576040516282b42960e81b815260040160405180910390fd5b6001600160a01b038116610b195760405163d92e233d60e01b815260040160405180910390fd5b5f80546001600160a01b0319166001600160a01b03838116918217909255600154604051600160a01b820460ff16151581529216915f516020611e935f395f51905f52906020016108bf565b333014801590610b8057506001546001600160a01b03163314155b8015610b8c5750333214155b15610ba9576040516282b42960e81b815260040160405180910390fd5b5f546001600160a01b0316610bd15760405163d92e233d60e01b815260040160405180910390fd5b475f819003610bdd5750565b5f80546040516001600160a01b039091169083908381818185875af1925050503d805f8114610c27576040519150601f19603f3d011682016040523d82523d5f602084013e610c2c565b606091505b5050905080610c4e5760405163096dc0e160e01b815260040160405180910390fd5b5f546040518381526001600160a01b039091169030907fba3e71c2881efe881d169a722215ae66587e85bf64bcc507f2904a7345afeba090602001610709565b565b333014801590610cab57506001546001600160a01b03163314155b8015610cb75750333214155b15610cd4576040516282b42960e81b815260040160405180910390fd5b6001600160a01b038116610cfb5760405163d92e233d60e01b815260040160405180910390fd5b6040516370a0823160e01b81523060048201525f906001600160a01b038416906370a0823190602401602060405180830381865afa158015610d3f573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610d639190611d4a565b9050805f03610d8557604051633dbd9b6d60e11b815260040160405180910390fd5b610d90838383611792565b816001600160a01b0316836001600160a01b03165f516020611e735f395f51905f52836040516107cb91815260200190565b333014801590610dd25750333214155b15610def576040516282b42960e81b815260040160405180910390fd5b60018054821515600160a01b90810260ff60a01b1983168117938490555f546040516001600160a01b0392831694831694909417949116925f516020611e935f395f51905f52926108bf920460ff161515815260200190565b333014801590610e6357506001546001600160a01b03163314155b8015610e6f5750333214155b15610e8c576040516282b42960e81b815260040160405180910390fd5b5f546001600160a01b0316610eb45760405163d92e233d60e01b815260040160405180910390fd5b5f5b81811015610ffc575f838383818110610ed157610ed1611d61565b9050602002016020810190610ee691906119d4565b6040516370a0823160e01b81523060048201526001600160a01b0391909116906370a0823190602401602060405180830381865afa158015610f2a573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610f4e9190611d4a565b90508015610ff357610f91848484818110610f6b57610f6b611d61565b9050602002016020810190610f8091906119d4565b5f546001600160a01b031683611792565b5f546001600160a01b0316848484818110610fae57610fae611d61565b9050602002016020810190610fc391906119d4565b6001600160a01b03165f516020611e735f395f51905f5283604051610fea91815260200190565b60405180910390a35b50600101610eb6565b505050565b60605f7f8b320d3f82cb30ceac499bfb603ebdd270ad1f5e27a1cbe7a0dc0bdcadb6c38a5f1b88888888604051611039929190611db8565b60405190819003812060025461107b959493926020019485526001600160a01b0393909316602085015260408401919091526060830152608082015260a00190565b6040516020818303038152906040528051906020012090505f61116c604080518082018252601481527322a4a81b9b981920baba37a337b93bb0b93232b960611b6020918201528151808301835260018152603160f81b9082015281517fc2f8787176b8ac6bf7215b4adcc1e069bf4ab82d9ab1df05a57a91d425935b6e818301527f7ef4872878b04ee4262301fdfc75f3b60aa572501746f630bab1db203d799002818401527fc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc66060820152466080808301919091528351808303909101815260a0909101909252815191012090565b60405161190160f01b60208201526022810191909152604281018390526062016040516020818303038152906040528051906020012090505f6111e48287878080601f0160208091040260200160405190810160405280939291908181526020018383808284375f9201919091525061187e92505050565b90506001600160a01b03811661120c576040516282b42960e81b815260040160405180910390fd5b60028054905f61121b83611e10565b91905055505f5f8b6001600160a01b03168b8b8b60405161123d929190611db8565b5f6040518083038185875af1925050503d805f8114611277576040519150601f19603f3d011682016040523d82523d5f602084013e61127c565b606091505b50915091508161129f57604051632b3f6d1160e21b815260040160405180910390fd5b8b6001600160a01b03167fcaf938de11c367272220bfd1d2baa99ca46665e7bc4d85f00adb51b90fe1fa9f8c8c8c6040516112dc93929190611dc7565b60405180910390a29b9a5050505050505050505050565b3330148015906113035750333214155b15611320576040516282b42960e81b815260040160405180910390fd5b5f546001600160a01b03161580159061133857505f47115b15610c8e575f80546040516001600160a01b039091169047908381818185875af1925050503d805f8114611387576040519150601f19603f3d011682016040523d82523d5f602084013e61138c565b606091505b50509050806113ae5760405163096dc0e160e01b815260040160405180910390fd5b5f546040514781526001600160a01b039091169030907fba3e71c2881efe881d169a722215ae66587e85bf64bcc507f2904a7345afeba0906020016108bf565b60603330148015906114005750333214155b1561141d576040516282b42960e81b815260040160405180910390fd5b5f5f866001600160a01b031686868660405161143a929190611db8565b5f6040518083038185875af1925050503d805f8114611474576040519150601f19603f3d011682016040523d82523d5f602084013e611479565b606091505b50915091508161149c57604051632b3f6d1160e21b815260040160405180910390fd5b866001600160a01b03167fcaf938de11c367272220bfd1d2baa99ca46665e7bc4d85f00adb51b90fe1fa9f8787876040516114d993929190611dc7565b60405180910390a29695505050505050565b3330148015906114fb5750333214155b15611518576040516282b42960e81b815260040160405180910390fd5b600154600160a81b900460ff16156115425760405162dc149f60e41b815260040160405180910390fd5b6001600160a01b0383166115695760405163d92e233d60e01b815260040160405180910390fd5b5f80546001600160a01b0319166001600160a01b03858116918217835560018054600160a81b9287166001600160a81b03199091168117600160a01b871515021760ff60a81b191692909217905560405190927f3cd5ec01b1ae7cfec6ca1863e2cd6aa25d6d1702825803ff2b7cc95010fffdc291a3505050565b3330148015906115ff57506001546001600160a01b03163314155b801561160b5750333214155b15611628576040516282b42960e81b815260040160405180910390fd5b6001600160a01b03811661164f5760405163d92e233d60e01b815260040160405180910390fd5b5f5b8281101561178c575f84848381811061166c5761166c611d61565b905060200201602081019061168191906119d4565b6040516370a0823160e01b81523060048201526001600160a01b0391909116906370a0823190602401602060405180830381865afa1580156116c5573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906116e99190611d4a565b905080156117835761172285858481811061170657611706611d61565b905060200201602081019061171b91906119d4565b8483611792565b826001600160a01b031685858481811061173e5761173e611d61565b905060200201602081019061175391906119d4565b6001600160a01b03165f516020611e735f395f51905f528360405161177a91815260200190565b60405180910390a35b50600101611651565b50505050565b604080516001600160a01b038481166024830152604480830185905283518084039091018152606490920183526020820180516001600160e01b031663a9059cbb60e01b17905291515f928392908716916117ed9190611e28565b5f604051808303815f865af19150503d805f8114611826576040519150601f19603f3d011682016040523d82523d5f602084013e61182b565b606091505b509150915081158061185957505f81511180156118595750808060200190518101906118579190611e3e565b155b156118775760405163022e258160e11b815260040160405180910390fd5b5050505050565b5f81516041146118d55760405162461bcd60e51b815260206004820152601860248201527f496e76616c6964207369676e6174757265206c656e677468000000000000000060448201526064015b60405180910390fd5b6020820151604083015160608401515f1a601b8110156118fd576118fa601b82611e59565b90505b8060ff16601b1415801561191557508060ff16601c14155b156119545760405162461bcd60e51b815260206004820152600f60248201526e496e76616c696420762076616c756560881b60448201526064016118cc565b604080515f81526020810180835288905260ff831691810191909152606081018490526080810183905260019060a0016020604051602081039080840390855afa1580156119a4573d5f5f3e3d5ffd5b5050604051601f190151979650505050505050565b80356001600160a01b03811681146119cf575f5ffd5b919050565b5f602082840312156119e4575f5ffd5b6119ed826119b9565b9392505050565b8015158114611a01575f5ffd5b50565b5f5f5f60608486031215611a16575f5ffd5b611a1f846119b9565b9250611a2d602085016119b9565b91506040840135611a3d816119f4565b809150509250925092565b5f5f83601f840112611a58575f5ffd5b50813567ffffffffffffffff811115611a6f575f5ffd5b6020830191508360208260051b8501011115611a89575f5ffd5b9250929050565b5f5f5f5f5f5f60608789031215611aa5575f5ffd5b863567ffffffffffffffff811115611abb575f5ffd5b611ac789828a01611a48565b909750955050602087013567ffffffffffffffff811115611ae6575f5ffd5b611af289828a01611a48565b909550935050604087013567ffffffffffffffff811115611b11575f5ffd5b611b1d89828a01611a48565b979a9699509497509295939492505050565b5f5f60408385031215611b40575f5ffd5b611b49836119b9565b9150611b57602084016119b9565b90509250929050565b5f60208284031215611b70575f5ffd5b81356119ed816119f4565b5f5f60208385031215611b8c575f5ffd5b823567ffffffffffffffff811115611ba2575f5ffd5b611bae85828601611a48565b90969095509350505050565b5f5f83601f840112611bca575f5ffd5b50813567ffffffffffffffff811115611be1575f5ffd5b602083019150836020828501011115611a89575f5ffd5b5f5f5f5f5f5f60808789031215611c0d575f5ffd5b611c16876119b9565b955060208701359450604087013567ffffffffffffffff811115611c38575f5ffd5b611c4489828a01611bba565b909550935050606087013567ffffffffffffffff811115611c63575f5ffd5b611b1d89828a01611bba565b602081525f82518060208401528060208501604085015e5f604082850101526040601f19601f83011684010191505092915050565b5f5f5f5f60608587031215611cb7575f5ffd5b611cc0856119b9565b935060208501359250604085013567ffffffffffffffff811115611ce2575f5ffd5b611cee87828801611bba565b95989497509550505050565b5f5f5f60408486031215611d0c575f5ffd5b833567ffffffffffffffff811115611d22575f5ffd5b611d2e86828701611a48565b9094509250611d419050602085016119b9565b90509250925092565b5f60208284031215611d5a575f5ffd5b5051919050565b634e487b7160e01b5f52603260045260245ffd5b5f5f8335601e19843603018112611d8a575f5ffd5b83018035915067ffffffffffffffff821115611da4575f5ffd5b602001915036819003821315611a89575f5ffd5b818382375f9101908152919050565b83815260406020820152816040820152818360608301375f818301606090810191909152601f909201601f1916010192915050565b634e487b7160e01b5f52601160045260245ffd5b5f60018201611e2157611e21611dfc565b5060010190565b5f82518060208501845e5f920191825250919050565b5f60208284031215611e4e575f5ffd5b81516119ed816119f4565b60ff818116838216019081111561084057610840611dfc56fe115d7b5114b5954762cc233b141a7c777a8f79d93f50af7216d645c87fb4883e8f77097880cbeed821b47f9836e06b28a74d72de99667426584d993fe4f56e80a26469706673582212200f5b56c933b427281ff98c5cab944657649901064ba834d8b8766174e0f575e764736f6c634300081b0033";

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
