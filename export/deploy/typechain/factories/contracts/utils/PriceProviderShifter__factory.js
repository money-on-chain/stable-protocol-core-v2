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
exports.PriceProviderShifter__factory = void 0;
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
var ethers_1 = require("ethers");
var _abi = [
    {
        inputs: [
            {
                internalType: "contract IPriceProvider",
                name: "priceProvider_",
                type: "address",
            },
            {
                internalType: "int8",
                name: "shift_",
                type: "int8",
            },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    {
        inputs: [],
        name: "peek",
        outputs: [
            {
                internalType: "bytes32",
                name: "price",
                type: "bytes32",
            },
            {
                internalType: "bool",
                name: "hasPrice",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "priceProvider",
        outputs: [
            {
                internalType: "contract IPriceProvider",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "shift",
        outputs: [
            {
                internalType: "int8",
                name: "",
                type: "int8",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
];
var _bytecode = "0x608060405234801561001057600080fd5b5060405161043c38038061043c83398101604081905261002f91610061565b6000805460ff909216600160a01b026001600160a81b03199092166001600160a01b03909316929092171790556100ae565b6000806040838503121561007457600080fd5b82516001600160a01b038116811461008b57600080fd5b8092505060208301518060000b81146100a357600080fd5b809150509250929050565b61037f806100bd6000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c806312fc41ca1461004657806359e02dd714610073578063b888879e14610090575b600080fd5b6000805461005b91600160a01b909104900b81565b60405160009190910b81526020015b60405180910390f35b61007b6100bb565b6040805192835290151560208301520161006a565b6000546100a3906001600160a01b031681565b6040516001600160a01b03909116815260200161006a565b60008054604080516359e02dd760e01b8152815184936001600160a01b0316926359e02dd792600480820193918290030181865afa158015610101573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061012591906101ab565b60008054929450909250600160a01b909104810b1315610168576000805461015891600160a01b909104900b600a6102dc565b61016290836102f2565b91509091565b60008054600160a01b9004810b12156101a7576000805461019291600160a01b909104900b610309565b61019d90600a6102dc565b6101629083610327565b9091565b600080604083850312156101be57600080fd5b82519150602083015180151581146101d557600080fd5b809150509250929050565b634e487b7160e01b600052601160045260246000fd5b600181815b80851115610231578160001904821115610217576102176101e0565b8085161561022457918102915b93841c93908002906101fb565b509250929050565b600082610248575060016102d6565b81610255575060006102d6565b816001811461026b576002811461027557610291565b60019150506102d6565b60ff841115610286576102866101e0565b50506001821b6102d6565b5060208310610133831016604e8410600b84101617156102b4575081810a6102d6565b6102be83836101f6565b80600019048211156102d2576102d26101e0565b0290505b92915050565b60006102eb60ff841683610239565b9392505050565b80820281158282048414176102d6576102d66101e0565b600081810b6080810161031e5761031e6101e0565b60000392915050565b60008261034457634e487b7160e01b600052601260045260246000fd5b50049056fea264697066735822122043180cbe397369638af36cf919d218d540e2198fe4bcb2ed08e81dee8b4830f764736f6c63430008110033";
var isSuperArgs = function (xs) { return xs.length > 1; };
var PriceProviderShifter__factory = /** @class */ (function (_super) {
    __extends(PriceProviderShifter__factory, _super);
    function PriceProviderShifter__factory() {
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
    PriceProviderShifter__factory.prototype.deploy = function (priceProvider_, shift_, overrides) {
        return _super.prototype.deploy.call(this, priceProvider_, shift_, overrides || {});
    };
    PriceProviderShifter__factory.prototype.getDeployTransaction = function (priceProvider_, shift_, overrides) {
        return _super.prototype.getDeployTransaction.call(this, priceProvider_, shift_, overrides || {});
    };
    PriceProviderShifter__factory.prototype.attach = function (address) {
        return _super.prototype.attach.call(this, address);
    };
    PriceProviderShifter__factory.prototype.connect = function (signer) {
        return _super.prototype.connect.call(this, signer);
    };
    PriceProviderShifter__factory.createInterface = function () {
        return new ethers_1.utils.Interface(_abi);
    };
    PriceProviderShifter__factory.connect = function (address, signerOrProvider) {
        return new ethers_1.Contract(address, _abi, signerOrProvider);
    };
    PriceProviderShifter__factory.bytecode = _bytecode;
    PriceProviderShifter__factory.abi = _abi;
    return PriceProviderShifter__factory;
}(ethers_1.ContractFactory));
exports.PriceProviderShifter__factory = PriceProviderShifter__factory;
//# sourceMappingURL=PriceProviderShifter__factory.js.map