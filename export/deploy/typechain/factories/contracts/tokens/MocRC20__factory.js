"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MocRC20__factory = void 0;
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
var ethers_1 = require("ethers");
var _abi = [
    {
        inputs: [],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    {
        inputs: [],
        name: "InvalidAddress",
        type: "error",
    },
    {
        inputs: [],
        name: "InvalidValue",
        type: "error",
    },
    {
        inputs: [],
        name: "NotAuthorizedChanger",
        type: "error",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "address",
                name: "previousAdmin",
                type: "address",
            },
            {
                indexed: false,
                internalType: "address",
                name: "newAdmin",
                type: "address",
            },
        ],
        name: "AdminChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "owner",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "spender",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "value",
                type: "uint256",
            },
        ],
        name: "Approval",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "beacon",
                type: "address",
            },
        ],
        name: "BeaconUpgraded",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: "uint8",
                name: "version",
                type: "uint8",
            },
        ],
        name: "Initialized",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "bytes32",
                name: "role",
                type: "bytes32",
            },
            {
                indexed: true,
                internalType: "bytes32",
                name: "previousAdminRole",
                type: "bytes32",
            },
            {
                indexed: true,
                internalType: "bytes32",
                name: "newAdminRole",
                type: "bytes32",
            },
        ],
        name: "RoleAdminChanged",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "bytes32",
                name: "role",
                type: "bytes32",
            },
            {
                indexed: true,
                internalType: "address",
                name: "account",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "sender",
                type: "address",
            },
        ],
        name: "RoleGranted",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "bytes32",
                name: "role",
                type: "bytes32",
            },
            {
                indexed: true,
                internalType: "address",
                name: "account",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "sender",
                type: "address",
            },
        ],
        name: "RoleRevoked",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "from",
                type: "address",
            },
            {
                indexed: true,
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "value",
                type: "uint256",
            },
        ],
        name: "Transfer",
        type: "event",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "implementation",
                type: "address",
            },
        ],
        name: "Upgraded",
        type: "event",
    },
    {
        inputs: [],
        name: "BURNER_ROLE",
        outputs: [
            {
                internalType: "bytes32",
                name: "",
                type: "bytes32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "DEFAULT_ADMIN_ROLE",
        outputs: [
            {
                internalType: "bytes32",
                name: "",
                type: "bytes32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "MINTER_ROLE",
        outputs: [
            {
                internalType: "bytes32",
                name: "",
                type: "bytes32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "owner",
                type: "address",
            },
            {
                internalType: "address",
                name: "spender",
                type: "address",
            },
        ],
        name: "allowance",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "spender",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "approve",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "account",
                type: "address",
            },
        ],
        name: "balanceOf",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "burn",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "contract IGovernor",
                name: "newGovernor_",
                type: "address",
            },
        ],
        name: "changeGovernor",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "decimals",
        outputs: [
            {
                internalType: "uint8",
                name: "",
                type: "uint8",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "spender",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "subtractedValue",
                type: "uint256",
            },
        ],
        name: "decreaseAllowance",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes32",
                name: "role",
                type: "bytes32",
            },
        ],
        name: "getRoleAdmin",
        outputs: [
            {
                internalType: "bytes32",
                name: "",
                type: "bytes32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes32",
                name: "role",
                type: "bytes32",
            },
            {
                internalType: "uint256",
                name: "index",
                type: "uint256",
            },
        ],
        name: "getRoleMember",
        outputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes32",
                name: "role",
                type: "bytes32",
            },
        ],
        name: "getRoleMemberCount",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "governor",
        outputs: [
            {
                internalType: "contract IGovernor",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes32",
                name: "role",
                type: "bytes32",
            },
            {
                internalType: "address",
                name: "account",
                type: "address",
            },
        ],
        name: "grantRole",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "_account",
                type: "address",
            },
        ],
        name: "hasFullRoles",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes32",
                name: "role",
                type: "bytes32",
            },
            {
                internalType: "address",
                name: "account",
                type: "address",
            },
        ],
        name: "hasRole",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "spender",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "addedValue",
                type: "uint256",
            },
        ],
        name: "increaseAllowance",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "string",
                name: "name_",
                type: "string",
            },
            {
                internalType: "string",
                name: "symbol_",
                type: "string",
            },
            {
                internalType: "address",
                name: "admin_",
                type: "address",
            },
            {
                internalType: "contract IGovernor",
                name: "governor_",
                type: "address",
            },
        ],
        name: "initialize",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "mint",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "name",
        outputs: [
            {
                internalType: "string",
                name: "",
                type: "string",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "proxiableUUID",
        outputs: [
            {
                internalType: "bytes32",
                name: "",
                type: "bytes32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes32",
                name: "role",
                type: "bytes32",
            },
            {
                internalType: "address",
                name: "account",
                type: "address",
            },
        ],
        name: "renounceRole",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes32",
                name: "role",
                type: "bytes32",
            },
            {
                internalType: "address",
                name: "account",
                type: "address",
            },
        ],
        name: "revokeRole",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes4",
                name: "interfaceId",
                type: "bytes4",
            },
        ],
        name: "supportsInterface",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "symbol",
        outputs: [
            {
                internalType: "string",
                name: "",
                type: "string",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "totalSupply",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "transfer",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "from",
                type: "address",
            },
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "transferFrom",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "newImplementation",
                type: "address",
            },
        ],
        name: "upgradeTo",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "newImplementation",
                type: "address",
            },
            {
                internalType: "bytes",
                name: "data",
                type: "bytes",
            },
        ],
        name: "upgradeToAndCall",
        outputs: [],
        stateMutability: "payable",
        type: "function",
    },
];
var _bytecode = "0x60a06040523060805234801561001457600080fd5b5061001d610022565b6100e2565b600054610100900460ff161561008e5760405162461bcd60e51b815260206004820152602760248201527f496e697469616c697a61626c653a20636f6e747261637420697320696e697469604482015266616c697a696e6760c81b606482015260840160405180910390fd5b60005460ff90811610156100e0576000805460ff191660ff9081179091556040519081527f7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb38474024989060200160405180910390a15b565b6080516124db6200011a60003960008181610798015281816107d8015281816108bb015281816108fb015261098a01526124db6000f3fe6080604052600436106101d85760003560e01c806352d1902d11610102578063a457c2d711610095578063d547741f11610064578063d547741f14610566578063d55fd84514610586578063dd62ed3e146105a6578063e4c0aaf4146105c657600080fd5b8063a457c2d7146104e4578063a9059cbb14610504578063ca15c87314610524578063d53913931461054457600080fd5b806391d14854116100d157806391d148541461047a57806395d89b411461049a5780639dc29fac146104af578063a217fddf146104cf57600080fd5b806352d1902d146103ef57806370a08231146104045780638f15b4141461043a5780639010d07c1461045a57600080fd5b8063282c51f31161017a5780633659cfe6116101495780633659cfe61461037c578063395093511461039c57806340c10f19146103bc5780634f1ef286146103dc57600080fd5b8063282c51f3146102fc5780632f2ff15d1461031e578063313ce5671461034057806336568abe1461035c57600080fd5b80630c340a24116101b65780630c340a241461025457806318160ddd1461028d57806323b872dd146102ac578063248a9ca3146102cc57600080fd5b806301ffc9a7146101dd57806306fdde0314610212578063095ea7b314610234575b600080fd5b3480156101e957600080fd5b506101fd6101f8366004611d3f565b6105e6565b60405190151581526020015b60405180910390f35b34801561021e57600080fd5b50610227610611565b6040516102099190611d8d565b34801561024057600080fd5b506101fd61024f366004611dd5565b6106a3565b34801561026057600080fd5b5061019154610275906001600160a01b031681565b6040516001600160a01b039091168152602001610209565b34801561029957600080fd5b5060cb545b604051908152602001610209565b3480156102b857600080fd5b506101fd6102c7366004611e01565b6106bb565b3480156102d857600080fd5b5061029e6102e7366004611e42565b60009081526065602052604090206001015490565b34801561030857600080fd5b5061029e60008051602061241f83398151915281565b34801561032a57600080fd5b5061033e610339366004611e5b565b6106e1565b005b34801561034c57600080fd5b5060405160128152602001610209565b34801561036857600080fd5b5061033e610377366004611e5b565b61070b565b34801561038857600080fd5b5061033e610397366004611e8b565b61078e565b3480156103a857600080fd5b506101fd6103b7366004611dd5565b61086d565b3480156103c857600080fd5b5061033e6103d7366004611dd5565b61088f565b61033e6103ea366004611f34565b6108b1565b3480156103fb57600080fd5b5061029e61097d565b34801561041057600080fd5b5061029e61041f366004611e8b565b6001600160a01b0316600090815260c9602052604090205490565b34801561044657600080fd5b5061033e610455366004611fb8565b610a30565b34801561046657600080fd5b50610275610475366004612041565b610b49565b34801561048657600080fd5b506101fd610495366004611e5b565b610b61565b3480156104a657600080fd5b50610227610b8c565b3480156104bb57600080fd5b5061033e6104ca366004611dd5565b610b9b565b3480156104db57600080fd5b5061029e600081565b3480156104f057600080fd5b506101fd6104ff366004611dd5565b610bbd565b34801561051057600080fd5b506101fd61051f366004611dd5565b610c43565b34801561053057600080fd5b5061029e61053f366004611e42565b610c51565b34801561055057600080fd5b5061029e60008051602061248683398151915281565b34801561057257600080fd5b5061033e610581366004611e5b565b610c68565b34801561059257600080fd5b506101fd6105a1366004611e8b565b610c8d565b3480156105b257600080fd5b5061029e6105c1366004612063565b610cd8565b3480156105d257600080fd5b5061033e6105e1366004611e8b565b610d03565b60006001600160e01b03198216635a05180f60e01b148061060b575061060b82610d2e565b92915050565b606060cc805461062090612091565b80601f016020809104026020016040519081016040528092919081815260200182805461064c90612091565b80156106995780601f1061066e57610100808354040283529160200191610699565b820191906000526020600020905b81548152906001019060200180831161067c57829003601f168201915b5050505050905090565b6000336106b1818585610d63565b5060019392505050565b6000336106c9858285610e87565b6106d4858585610f01565b60019150505b9392505050565b6000828152606560205260409020600101546106fc816110ac565b61070683836110b6565b505050565b6001600160a01b03811633146107805760405162461bcd60e51b815260206004820152602f60248201527f416363657373436f6e74726f6c3a2063616e206f6e6c792072656e6f756e636560448201526e103937b632b9903337b91039b2b63360891b60648201526084015b60405180910390fd5b61078a82826110d8565b5050565b6001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001630036107d65760405162461bcd60e51b8152600401610777906120cb565b7f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031661081f60008051602061243f833981519152546001600160a01b031690565b6001600160a01b0316146108455760405162461bcd60e51b815260040161077790612117565b61084e816110fa565b6040805160008082526020820190925261086a91839190611102565b50565b6000336106b18185856108808383610cd8565b61088a9190612179565b610d63565b6000805160206124868339815191526108a7816110ac565b610706838361126d565b6001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001630036108f95760405162461bcd60e51b8152600401610777906120cb565b7f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031661094260008051602061243f833981519152546001600160a01b031690565b6001600160a01b0316146109685760405162461bcd60e51b815260040161077790612117565b610971826110fa565b61078a82826001611102565b6000306001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614610a1d5760405162461bcd60e51b815260206004820152603860248201527f555550535570677261646561626c653a206d757374206e6f742062652063616c60448201527f6c6564207468726f7567682064656c656761746563616c6c00000000000000006064820152608401610777565b5060008051602061243f83398151915290565b600054610100900460ff1615808015610a505750600054600160ff909116105b80610a6a5750303b158015610a6a575060005460ff166001145b610acd5760405162461bcd60e51b815260206004820152602e60248201527f496e697469616c697a61626c653a20636f6e747261637420697320616c72656160448201526d191e481a5b9a5d1a585b1a5e995960921b6064820152608401610777565b6000805460ff191660011790558015610af0576000805461ff0019166101001790555b610afc8585858561132e565b8015610b42576000805461ff0019169055604051600181527f7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb38474024989060200160405180910390a15b5050505050565b60008281526097602052604081206106da90836113b3565b60009182526065602090815260408084206001600160a01b0393909316845291905290205460ff1690565b606060cd805461062090612091565b60008051602061241f833981519152610bb3816110ac565b61070683836113bf565b60003381610bcb8286610cd8565b905083811015610c2b5760405162461bcd60e51b815260206004820152602560248201527f45524332303a2064656372656173656420616c6c6f77616e63652062656c6f77604482015264207a65726f60d81b6064820152608401610777565b610c388286868403610d63565b506001949350505050565b6000336106b1818585610f01565b600081815260976020526040812061060b906114f3565b600082815260656020526040902060010154610c83816110ac565b61070683836110d8565b6000610ca760008051602061248683398151915283610b61565b8015610cc65750610cc660008051602061241f83398151915283610b61565b801561060b575061060b600083610b61565b6001600160a01b03918216600090815260ca6020908152604080832093909416825291909152205490565b610d0b6114fd565b61019180546001600160a01b0319166001600160a01b0392909216919091179055565b60006001600160e01b03198216637965db0b60e01b148061060b57506301ffc9a760e01b6001600160e01b031983161461060b565b6001600160a01b038316610dc55760405162461bcd60e51b8152602060048201526024808201527f45524332303a20617070726f76652066726f6d20746865207a65726f206164646044820152637265737360e01b6064820152608401610777565b6001600160a01b038216610e265760405162461bcd60e51b815260206004820152602260248201527f45524332303a20617070726f766520746f20746865207a65726f206164647265604482015261737360f01b6064820152608401610777565b6001600160a01b03838116600081815260ca602090815260408083209487168084529482529182902085905590518481527f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925910160405180910390a3505050565b6000610e938484610cd8565b90506000198114610efb5781811015610eee5760405162461bcd60e51b815260206004820152601d60248201527f45524332303a20696e73756666696369656e7420616c6c6f77616e63650000006044820152606401610777565b610efb8484848403610d63565b50505050565b6001600160a01b038316610f655760405162461bcd60e51b815260206004820152602560248201527f45524332303a207472616e736665722066726f6d20746865207a65726f206164604482015264647265737360d81b6064820152608401610777565b6001600160a01b038216610fc75760405162461bcd60e51b815260206004820152602360248201527f45524332303a207472616e7366657220746f20746865207a65726f206164647260448201526265737360e81b6064820152608401610777565b6001600160a01b038316600090815260c960205260409020548181101561103f5760405162461bcd60e51b815260206004820152602660248201527f45524332303a207472616e7366657220616d6f756e7420657863656564732062604482015265616c616e636560d01b6064820152608401610777565b6001600160a01b03808516600081815260c9602052604080822086860390559286168082529083902080548601905591517fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9061109f9086815260200190565b60405180910390a3610efb565b61086a8133611589565b6110c082826115e2565b60008281526097602052604090206107069082611668565b6110e2828261167d565b600082815260976020526040902061070690826116e4565b61086a6114fd565b7f4910fdfa16fed3260ed0e7147f7cc6da11a60208b5b9406d12a635614ffd91435460ff161561113557610706836116f9565b826001600160a01b03166352d1902d6040518163ffffffff1660e01b8152600401602060405180830381865afa92505050801561118f575060408051601f3d908101601f1916820190925261118c9181019061218c565b60015b6111f25760405162461bcd60e51b815260206004820152602e60248201527f45524331393637557067726164653a206e657720696d706c656d656e7461746960448201526d6f6e206973206e6f74205555505360901b6064820152608401610777565b60008051602061243f83398151915281146112615760405162461bcd60e51b815260206004820152602960248201527f45524331393637557067726164653a20756e737570706f727465642070726f786044820152681a58589b195555525160ba1b6064820152608401610777565b50610706838383611795565b6001600160a01b0382166112c35760405162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f2061646472657373006044820152606401610777565b8060cb60008282546112d59190612179565b90915550506001600160a01b038216600081815260c960209081526040808320805486019055518481527fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef910160405180910390a35050565b600054610100900460ff166113555760405162461bcd60e51b8152600401610777906121a5565b61135f84846117ba565b6113676117eb565b61136f6117eb565b61137881611812565b611383600083611842565b61139b60008051602061248683398151915283611842565b610efb60008051602061241f83398151915283611842565b60006106da838361184c565b6001600160a01b03821661141f5760405162461bcd60e51b815260206004820152602160248201527f45524332303a206275726e2066726f6d20746865207a65726f206164647265736044820152607360f81b6064820152608401610777565b6001600160a01b038216600090815260c96020526040902054818110156114935760405162461bcd60e51b815260206004820152602260248201527f45524332303a206275726e20616d6f756e7420657863656564732062616c616e604482015261636560f01b6064820152608401610777565b6001600160a01b038316600081815260c960209081526040808320868603905560cb80548790039055518581529192917fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef910160405180910390a3505050565b600061060b825490565b6101915460405163d994d6d560e01b81523360048201526001600160a01b039091169063d994d6d590602401602060405180830381865afa158015611546573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061156a91906121f0565b61158757604051631dd1b1b560e21b815260040160405180910390fd5b565b6115938282610b61565b61078a576115a081611876565b6115ab836020611888565b6040516020016115bc929190612212565b60408051601f198184030181529082905262461bcd60e51b825261077791600401611d8d565b6115ec8282610b61565b61078a5760008281526065602090815260408083206001600160a01b03851684529091529020805460ff191660011790556116243390565b6001600160a01b0316816001600160a01b0316837f2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d60405160405180910390a45050565b60006106da836001600160a01b038416611a24565b6116878282610b61565b1561078a5760008281526065602090815260408083206001600160a01b0385168085529252808320805460ff1916905551339285917ff6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b9190a45050565b60006106da836001600160a01b038416611a73565b6001600160a01b0381163b6117665760405162461bcd60e51b815260206004820152602d60248201527f455243313936373a206e657720696d706c656d656e746174696f6e206973206e60448201526c1bdd08184818dbdb9d1c9858dd609a1b6064820152608401610777565b60008051602061243f83398151915280546001600160a01b0319166001600160a01b0392909216919091179055565b61179e83611b66565b6000825111806117ab5750805b1561070657610efb8383611ba6565b600054610100900460ff166117e15760405162461bcd60e51b8152600401610777906121a5565b61078a8282611c9a565b600054610100900460ff166115875760405162461bcd60e51b8152600401610777906121a5565b600054610100900460ff166118395760405162461bcd60e51b8152600401610777906121a5565b61086a81611cda565b61078a82826110b6565b600082600001828154811061186357611863612287565b9060005260206000200154905092915050565b606061060b6001600160a01b03831660145b6060600061189783600261229d565b6118a2906002612179565b67ffffffffffffffff8111156118ba576118ba611ea8565b6040519080825280601f01601f1916602001820160405280156118e4576020820181803683370190505b509050600360fc1b816000815181106118ff576118ff612287565b60200101906001600160f81b031916908160001a905350600f60fb1b8160018151811061192e5761192e612287565b60200101906001600160f81b031916908160001a905350600061195284600261229d565b61195d906001612179565b90505b60018111156119d5576f181899199a1a9b1b9c1cb0b131b232b360811b85600f166010811061199157611991612287565b1a60f81b8282815181106119a7576119a7612287565b60200101906001600160f81b031916908160001a90535060049490941c936119ce816122b4565b9050611960565b5083156106da5760405162461bcd60e51b815260206004820181905260248201527f537472696e67733a20686578206c656e67746820696e73756666696369656e746044820152606401610777565b6000818152600183016020526040812054611a6b5750815460018181018455600084815260208082209093018490558454848252828601909352604090209190915561060b565b50600061060b565b60008181526001830160205260408120548015611b5c576000611a976001836122cb565b8554909150600090611aab906001906122cb565b9050818114611b10576000866000018281548110611acb57611acb612287565b9060005260206000200154905080876000018481548110611aee57611aee612287565b6000918252602080832090910192909255918252600188019052604090208390555b8554869080611b2157611b216122de565b60019003818190600052602060002001600090559055856001016000868152602001908152602001600020600090556001935050505061060b565b600091505061060b565b611b6f816116f9565b6040516001600160a01b038216907fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b90600090a250565b60606001600160a01b0383163b611c0e5760405162461bcd60e51b815260206004820152602660248201527f416464726573733a2064656c65676174652063616c6c20746f206e6f6e2d636f6044820152651b9d1c9858dd60d21b6064820152608401610777565b600080846001600160a01b031684604051611c2991906122f4565b600060405180830381855af49150503d8060008114611c64576040519150601f19603f3d011682016040523d82523d6000602084013e611c69565b606091505b5091509150611c91828260405180606001604052806027815260200161245f60279139611d01565b95945050505050565b600054610100900460ff16611cc15760405162461bcd60e51b8152600401610777906121a5565b60cc611ccd838261235e565b5060cd610706828261235e565b600054610100900460ff16610d0b5760405162461bcd60e51b8152600401610777906121a5565b60608315611d105750816106da565b6106da8383815115611d255781518083602001fd5b8060405162461bcd60e51b81526004016107779190611d8d565b600060208284031215611d5157600080fd5b81356001600160e01b0319811681146106da57600080fd5b60005b83811015611d84578181015183820152602001611d6c565b50506000910152565b6020815260008251806020840152611dac816040850160208701611d69565b601f01601f19169190910160400192915050565b6001600160a01b038116811461086a57600080fd5b60008060408385031215611de857600080fd5b8235611df381611dc0565b946020939093013593505050565b600080600060608486031215611e1657600080fd5b8335611e2181611dc0565b92506020840135611e3181611dc0565b929592945050506040919091013590565b600060208284031215611e5457600080fd5b5035919050565b60008060408385031215611e6e57600080fd5b823591506020830135611e8081611dc0565b809150509250929050565b600060208284031215611e9d57600080fd5b81356106da81611dc0565b634e487b7160e01b600052604160045260246000fd5b600067ffffffffffffffff80841115611ed957611ed9611ea8565b604051601f8501601f19908116603f01168101908282118183101715611f0157611f01611ea8565b81604052809350858152868686011115611f1a57600080fd5b858560208301376000602087830101525050509392505050565b60008060408385031215611f4757600080fd5b8235611f5281611dc0565b9150602083013567ffffffffffffffff811115611f6e57600080fd5b8301601f81018513611f7f57600080fd5b611f8e85823560208401611ebe565b9150509250929050565b600082601f830112611fa957600080fd5b6106da83833560208501611ebe565b60008060008060808587031215611fce57600080fd5b843567ffffffffffffffff80821115611fe657600080fd5b611ff288838901611f98565b9550602087013591508082111561200857600080fd5b5061201587828801611f98565b935050604085013561202681611dc0565b9150606085013561203681611dc0565b939692955090935050565b6000806040838503121561205457600080fd5b50508035926020909101359150565b6000806040838503121561207657600080fd5b823561208181611dc0565b91506020830135611e8081611dc0565b600181811c908216806120a557607f821691505b6020821081036120c557634e487b7160e01b600052602260045260246000fd5b50919050565b6020808252602c908201527f46756e6374696f6e206d7573742062652063616c6c6564207468726f7567682060408201526b19195b1959d85d1958d85b1b60a21b606082015260800190565b6020808252602c908201527f46756e6374696f6e206d7573742062652063616c6c6564207468726f7567682060408201526b6163746976652070726f787960a01b606082015260800190565b634e487b7160e01b600052601160045260246000fd5b8082018082111561060b5761060b612163565b60006020828403121561219e57600080fd5b5051919050565b6020808252602b908201527f496e697469616c697a61626c653a20636f6e7472616374206973206e6f74206960408201526a6e697469616c697a696e6760a81b606082015260800190565b60006020828403121561220257600080fd5b815180151581146106da57600080fd5b7f416363657373436f6e74726f6c3a206163636f756e742000000000000000000081526000835161224a816017850160208801611d69565b7001034b99036b4b9b9b4b733903937b6329607d1b601791840191820152835161227b816028840160208801611d69565b01602801949350505050565b634e487b7160e01b600052603260045260246000fd5b808202811582820484141761060b5761060b612163565b6000816122c3576122c3612163565b506000190190565b8181038181111561060b5761060b612163565b634e487b7160e01b600052603160045260246000fd5b60008251612306818460208701611d69565b9190910192915050565b601f82111561070657600081815260208120601f850160051c810160208610156123375750805b601f850160051c820191505b8181101561235657828155600101612343565b505050505050565b815167ffffffffffffffff81111561237857612378611ea8565b61238c816123868454612091565b84612310565b602080601f8311600181146123c157600084156123a95750858301515b600019600386901b1c1916600185901b178555612356565b600085815260208120601f198616915b828110156123f0578886015182559484019460019091019084016123d1565b508582101561240e5787850151600019600388901b60f8161c191681555b5050505050600190811b0190555056fe3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc416464726573733a206c6f772d6c6576656c2064656c65676174652063616c6c206661696c65649f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6a26469706673582212209b84d9b09eac16df6f202255a5f965fa421b2997eee492ed4ad4d5a225b8b28c64736f6c63430008110033";
var isSuperArgs = function (xs) { return xs.length > 1; };
var MocRC20__factory = /** @class */ (function (_super) {
    __extends(MocRC20__factory, _super);
    function MocRC20__factory() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var _this = this;
        if (isSuperArgs(args)) {
            _this = _super.apply(this, args) || this;
        }
        else {
            _this = _super.call(this, _abi, _bytecode, args[0]) || this;
        }
        return _this;
    }
    MocRC20__factory.prototype.deploy = function (overrides) {
        return _super.prototype.deploy.call(this, overrides || {});
    };
    MocRC20__factory.prototype.getDeployTransaction = function (overrides) {
        return _super.prototype.getDeployTransaction.call(this, overrides || {});
    };
    MocRC20__factory.prototype.attach = function (address) {
        return _super.prototype.attach.call(this, address);
    };
    MocRC20__factory.prototype.connect = function (signer) {
        return _super.prototype.connect.call(this, signer);
    };
    MocRC20__factory.createInterface = function () {
        return new ethers_1.utils.Interface(_abi);
    };
    MocRC20__factory.connect = function (address, signerOrProvider) {
        return new ethers_1.Contract(address, _abi, signerOrProvider);
    };
    MocRC20__factory.bytecode = _bytecode;
    MocRC20__factory.abi = _abi;
    return MocRC20__factory;
}(ethers_1.ContractFactory));
exports.MocRC20__factory = MocRC20__factory;
//# sourceMappingURL=MocRC20__factory.js.map