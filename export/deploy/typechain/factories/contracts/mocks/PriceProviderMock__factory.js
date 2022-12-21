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
exports.PriceProviderMock__factory = void 0;
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
var ethers_1 = require("ethers");
var _abi = [
    {
        inputs: [
            {
                internalType: "uint256",
                name: "price_",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    {
        inputs: [],
        name: "deprecatePriceProvider",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "has",
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
        name: "mocPrice",
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
        name: "peek",
        outputs: [
            {
                internalType: "bytes32",
                name: "",
                type: "bytes32",
            },
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
                internalType: "uint256",
                name: "price_",
                type: "uint256",
            },
        ],
        name: "poke",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
];
var _bytecode = "0x608060405234801561001057600080fd5b5060405161018138038061018183398101604081905261002f91610043565b6000556001805460ff19168117905561005c565b60006020828403121561005557600080fd5b5051919050565b6101168061006b6000396000f3fe6080604052348015600f57600080fd5b506004361060505760003560e01c80632a3f438914605557806332145f901460705780635095e3d914608257806359e02dd7146090578063b689d5ac1460ad575b600080fd5b605d60005481565b6040519081526020015b60405180910390f35b6080607b36600460c8565b600055565b005b60806001805460ff19169055565b60005460015460ff16604080519283529015156020830152016067565b60015460b99060ff1681565b60405190151581526020016067565b60006020828403121560d957600080fd5b503591905056fea26469706673582212202f32d9766874d6a34191093ea824c1f980a41bb7d175c2d324f81871df97720a64736f6c63430008110033";
var isSuperArgs = function (xs) { return xs.length > 1; };
var PriceProviderMock__factory = /** @class */ (function (_super) {
    __extends(PriceProviderMock__factory, _super);
    function PriceProviderMock__factory() {
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
    PriceProviderMock__factory.prototype.deploy = function (price_, overrides) {
        return _super.prototype.deploy.call(this, price_, overrides || {});
    };
    PriceProviderMock__factory.prototype.getDeployTransaction = function (price_, overrides) {
        return _super.prototype.getDeployTransaction.call(this, price_, overrides || {});
    };
    PriceProviderMock__factory.prototype.attach = function (address) {
        return _super.prototype.attach.call(this, address);
    };
    PriceProviderMock__factory.prototype.connect = function (signer) {
        return _super.prototype.connect.call(this, signer);
    };
    PriceProviderMock__factory.createInterface = function () {
        return new ethers_1.utils.Interface(_abi);
    };
    PriceProviderMock__factory.connect = function (address, signerOrProvider) {
        return new ethers_1.Contract(address, _abi, signerOrProvider);
    };
    PriceProviderMock__factory.bytecode = _bytecode;
    PriceProviderMock__factory.abi = _abi;
    return PriceProviderMock__factory;
}(ethers_1.ContractFactory));
exports.PriceProviderMock__factory = PriceProviderMock__factory;
//# sourceMappingURL=PriceProviderMock__factory.js.map