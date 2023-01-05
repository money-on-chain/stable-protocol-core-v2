"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addAssetsAndChangeGovernor = exports.addPeggedTokensAndChangeGovernor = exports.getNetworkDeployParams = exports.deployUUPSArtifact = exports.waitForTxConfirmation = void 0;
var hardhat_1 = require("hardhat");
var waitForTxConfirmation = function (tx, confirmations) {
    if (confirmations === void 0) { confirmations = 1; }
    return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tx];
                case 1: return [2 /*return*/, (_a.sent()).wait(confirmations)];
            }
        });
    });
};
exports.waitForTxConfirmation = waitForTxConfirmation;
var deployUUPSArtifact = function (_a) {
    var hre = _a.hre, artifactBaseName = _a.artifactBaseName, contract = _a.contract;
    return __awaiter(void 0, void 0, void 0, function () {
        var deployments, getNamedAccounts, deployer, deploy, gasLimit, deployImplResult, deployProxyResult;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    deployments = hre.deployments, getNamedAccounts = hre.getNamedAccounts;
                    return [4 /*yield*/, getNamedAccounts()];
                case 1:
                    deployer = (_b.sent()).deployer;
                    deploy = deployments.deploy;
                    gasLimit = (0, exports.getNetworkDeployParams)(hre).gasLimit;
                    artifactBaseName = artifactBaseName || contract;
                    return [4 /*yield*/, deploy("".concat(artifactBaseName, "Impl"), {
                            contract: contract,
                            from: deployer,
                            gasLimit: gasLimit,
                        })];
                case 2:
                    deployImplResult = _b.sent();
                    console.log("".concat(contract, ", as ").concat(artifactBaseName, " implementation deployed at ").concat(deployImplResult.address));
                    return [4 /*yield*/, deploy("".concat(artifactBaseName, "Proxy"), {
                            contract: "ERC1967Proxy",
                            from: deployer,
                            gasLimit: gasLimit,
                            args: [deployImplResult.address, "0x"],
                        })];
                case 3:
                    deployProxyResult = _b.sent();
                    console.log("".concat(artifactBaseName, " ERC1967Proxy deployed at ").concat(deployProxyResult.address));
                    return [2 /*return*/];
            }
        });
    });
};
exports.deployUUPSArtifact = deployUUPSArtifact;
var getNetworkDeployParams = function (hre) {
    var network = hre.network.name === "localhost" ? "hardhat" : hre.network.name;
    return hre.config.networks[network].deployParameters;
};
exports.getNetworkDeployParams = getNetworkDeployParams;
var addPeggedTokensAndChangeGovernor = function (hre, governorAddress, mocCore, tpParams) { return __awaiter(void 0, void 0, void 0, function () {
    var gasLimit, deployments, signer, i, mocRC20TP, mocRC20Proxy;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                gasLimit = (0, exports.getNetworkDeployParams)(hre).gasLimit;
                if (!tpParams) return [3 /*break*/, 8];
                deployments = hre.deployments;
                signer = hardhat_1.ethers.provider.getSigner();
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < tpParams.tpParams.length)) return [3 /*break*/, 8];
                return [4 /*yield*/, (0, exports.deployUUPSArtifact)({ hre: hre, artifactBaseName: tpParams.tpParams[i].name, contract: "MocRC20" })];
            case 2:
                _a.sent();
                return [4 /*yield*/, deployments.getOrNull(tpParams.tpParams[i].name + "Proxy")];
            case 3:
                mocRC20TP = _a.sent();
                if (!mocRC20TP)
                    throw new Error("No ".concat(tpParams.tpParams[i].name, " deployed"));
                return [4 /*yield*/, hardhat_1.ethers.getContractAt("MocRC20", mocRC20TP.address, signer)];
            case 4:
                mocRC20Proxy = _a.sent();
                console.log("Initializing ".concat(tpParams.tpParams[i].name, " PeggedToken..."));
                return [4 /*yield*/, (0, exports.waitForTxConfirmation)(mocRC20Proxy.initialize(tpParams.tpParams[i].name, tpParams.tpParams[i].symbol, mocCore.address, governorAddress, {
                        gasLimit: gasLimit,
                    }))];
            case 5:
                _a.sent();
                console.log("Adding ".concat(tpParams.tpParams[i].name, " as PeggedToken ").concat(i, "..."));
                return [4 /*yield*/, (0, exports.waitForTxConfirmation)(mocCore.addPeggedToken({
                        tpTokenAddress: mocRC20Proxy.address.toLowerCase(),
                        priceProviderAddress: tpParams.tpParams[i].priceProvider,
                        tpCtarg: tpParams.tpParams[i].ctarg,
                        tpMintFee: tpParams.tpParams[i].mintFee,
                        tpRedeemFee: tpParams.tpParams[i].redeemFee,
                        tpEma: tpParams.tpParams[i].initialEma,
                        tpEmaSf: tpParams.tpParams[i].smoothingFactor,
                    }, {
                        gasLimit: gasLimit,
                    }))];
            case 6:
                _a.sent();
                _a.label = 7;
            case 7:
                i++;
                return [3 /*break*/, 1];
            case 8:
                console.log("Renouncing temp governance...");
                return [4 /*yield*/, (0, exports.waitForTxConfirmation)(mocCore.changeGovernor(governorAddress, {
                        gasLimit: gasLimit,
                    }))];
            case 9:
                _a.sent();
                console.log("mocCore governor is now: ".concat(governorAddress));
                return [2 /*return*/];
        }
    });
}); };
exports.addPeggedTokensAndChangeGovernor = addPeggedTokensAndChangeGovernor;
var addAssetsAndChangeGovernor = function (hre, governorAddress, mocWrapper, assetParams) { return __awaiter(void 0, void 0, void 0, function () {
    var gasLimit, i, priceProvider, shifterFactory, shiftedPriceProvider;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                gasLimit = (0, exports.getNetworkDeployParams)(hre).gasLimit;
                if (!assetParams) return [3 /*break*/, 7];
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < assetParams.assetParams.length)) return [3 /*break*/, 7];
                console.log("Adding ".concat(assetParams.assetParams[i].assetAddress, " as Asset ").concat(i, "..."));
                priceProvider = assetParams.assetParams[i].priceProvider;
                if (!(assetParams.assetParams[i].decimals < 18)) return [3 /*break*/, 4];
                console.log("Deploying price provider shifter");
                return [4 /*yield*/, hardhat_1.ethers.getContractFactory("PriceProviderShifter")];
            case 2:
                shifterFactory = _a.sent();
                return [4 /*yield*/, shifterFactory.deploy(assetParams.assetParams[i].priceProvider, 18 - assetParams.assetParams[i].decimals)];
            case 3:
                shiftedPriceProvider = _a.sent();
                priceProvider = shiftedPriceProvider.address;
                console.log("price provider shifter deployed at: ".concat(priceProvider));
                _a.label = 4;
            case 4: return [4 /*yield*/, (0, exports.waitForTxConfirmation)(mocWrapper.addOrEditAsset(assetParams.assetParams[i].assetAddress, priceProvider, assetParams.assetParams[i].decimals, {
                    gasLimit: gasLimit,
                }))];
            case 5:
                _a.sent();
                _a.label = 6;
            case 6:
                i++;
                return [3 /*break*/, 1];
            case 7:
                console.log("Renouncing temp governance...");
                return [4 /*yield*/, (0, exports.waitForTxConfirmation)(mocWrapper.changeGovernor(governorAddress, {
                        gasLimit: gasLimit,
                    }))];
            case 8:
                _a.sent();
                console.log("MocCAWrapper governor is now: ".concat(governorAddress));
                return [2 /*return*/];
        }
    });
}); };
exports.addAssetsAndChangeGovernor = addAssetsAndChangeGovernor;
//# sourceMappingURL=utils.js.map