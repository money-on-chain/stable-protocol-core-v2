"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
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
exports.deployCARC20 = exports.addPeggedTokensAndChangeGovernor = exports.getNetworkDeployParams = exports.deployVendors = exports.getGovernorAddresses = exports.deployCollateralToken = exports.deployUUPSArtifact = exports.waitForTxConfirmation = void 0;
var hardhat_1 = require("hardhat");
var utils_1 = require("../test/helpers/utils");
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
    var hre = _a.hre, artifactBaseName = _a.artifactBaseName, contract = _a.contract, initializeArgs = _a.initializeArgs;
    return __awaiter(void 0, void 0, void 0, function () {
        var deploy, getNamedAccounts, deployer, gasLimit, execute, deployResult;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    deploy = hre.deployments.deploy, getNamedAccounts = hre.getNamedAccounts;
                    return [4 /*yield*/, getNamedAccounts()];
                case 1:
                    deployer = (_b.sent()).deployer;
                    gasLimit = (0, exports.getNetworkDeployParams)(hre).gasLimit;
                    artifactBaseName = artifactBaseName || contract;
                    if (initializeArgs) {
                        execute = {
                            init: {
                                methodName: "initialize",
                                args: initializeArgs,
                            },
                        };
                    }
                    return [4 /*yield*/, deploy("".concat(artifactBaseName, "Proxy"), {
                            contract: contract,
                            from: deployer,
                            proxy: {
                                proxyContract: "UUPS",
                                execute: execute,
                            },
                            gasLimit: gasLimit,
                        })];
                case 2:
                    deployResult = _b.sent();
                    console.log("".concat(contract, ", as ").concat(artifactBaseName, " implementation deployed at ").concat(deployResult.implementation));
                    console.log("".concat(artifactBaseName, "Proxy ERC1967Proxy deployed at ").concat(deployResult.address));
                    return [2 /*return*/, deployResult];
            }
        });
    });
};
exports.deployUUPSArtifact = deployUUPSArtifact;
var deployCollateralToken = function (artifactBaseName) { return function (hre) { return __awaiter(void 0, void 0, void 0, function () {
    var ctParams, governorAddress, deployer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ctParams = (0, exports.getNetworkDeployParams)(hre).ctParams;
                governorAddress = (0, exports.getGovernorAddresses)(hre);
                return [4 /*yield*/, hre.getNamedAccounts()];
            case 1:
                deployer = (_a.sent()).deployer;
                return [4 /*yield*/, (0, exports.deployUUPSArtifact)({
                        hre: hre,
                        artifactBaseName: artifactBaseName,
                        contract: "MocTC",
                        initializeArgs: [
                            ctParams.name,
                            ctParams.symbol,
                            deployer,
                            governorAddress,
                        ],
                    })];
            case 2:
                _a.sent();
                return [2 /*return*/, hre.network.live]; // prevents re execution on live networks
        }
    });
}); }; };
exports.deployCollateralToken = deployCollateralToken;
var getGovernorAddresses = function (hre) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, governorAddress, gasLimit, deploy, getNamedAccounts, deployer, deployResult;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = (0, exports.getNetworkDeployParams)(hre), governorAddress = _a.mocAddresses.governorAddress, gasLimit = _a.gasLimit;
                if (!(hre.network.tags.testnet || hre.network.tags.local)) return [3 /*break*/, 3];
                deploy = hre.deployments.deploy, getNamedAccounts = hre.getNamedAccounts;
                return [4 /*yield*/, getNamedAccounts()];
            case 1:
                deployer = (_b.sent()).deployer;
                return [4 /*yield*/, deploy("GovernorMock", {
                        contract: "GovernorMock",
                        from: deployer,
                        gasLimit: gasLimit,
                    })];
            case 2:
                deployResult = _b.sent();
                governorAddress = deployResult.address;
                _b.label = 3;
            case 3: return [2 /*return*/, governorAddress];
        }
    });
}); };
exports.getGovernorAddresses = getGovernorAddresses;
var deployVendors = function (artifactBaseName) { return function (hre) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, pauserAddress, vendorsGuardianAddress, _b, _c;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = (0, exports.getNetworkDeployParams)(hre).mocAddresses, pauserAddress = _a.pauserAddress, vendorsGuardianAddress = _a.vendorsGuardianAddress;
                _b = exports.deployUUPSArtifact;
                _d = {
                    hre: hre,
                    artifactBaseName: artifactBaseName,
                    contract: "MocVendors"
                };
                _c = [vendorsGuardianAddress];
                return [4 /*yield*/, (0, exports.getGovernorAddresses)(hre)];
            case 1: return [4 /*yield*/, _b.apply(void 0, [(_d.initializeArgs = _c.concat([_e.sent(), pauserAddress]),
                        _d)])];
            case 2:
                _e.sent();
                return [2 /*return*/, hre.network.live]; // prevents re execution on live networks
        }
    });
}); }; };
exports.deployVendors = deployVendors;
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
var deployCARC20 = function (hre, mocCARC20Variant, ctVariant, extraInitParams) {
    if (extraInitParams === void 0) { extraInitParams = {}; }
    return __awaiter(void 0, void 0, void 0, function () {
        var deployments, getNamedAccounts, deployer, _a, coreParams, settlementParams, feeParams, tpParams, mocAddresses, gasLimit, signer, deployedMocExpansionContract, deployedTCContract, CollateralToken, deployedMocVendors, collateralAssetAddress, pauserAddress, feeTokenAddress, feeTokenPriceProviderAddress, mocFeeFlowAddress, mocAppreciationBeneficiaryAddress, tcInterestCollectorAddress, maxAbsoluteOpProviderAddress, maxOpDiffProviderAddress, governorAddress, deployedERC20MockContract, rc20MockFactory, priceProviderMockFactory, DataProviderMockFactory, mocCARC20;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    deployments = hre.deployments, getNamedAccounts = hre.getNamedAccounts;
                    return [4 /*yield*/, getNamedAccounts()];
                case 1:
                    deployer = (_b.sent()).deployer;
                    _a = (0, exports.getNetworkDeployParams)(hre), coreParams = _a.coreParams, settlementParams = _a.settlementParams, feeParams = _a.feeParams, tpParams = _a.tpParams, mocAddresses = _a.mocAddresses, gasLimit = _a.gasLimit;
                    signer = hardhat_1.ethers.provider.getSigner();
                    return [4 /*yield*/, deployments.getOrNull("MocCARC20Expansion")];
                case 2:
                    deployedMocExpansionContract = _b.sent();
                    if (!deployedMocExpansionContract)
                        throw new Error("No MocCARC20Expansion deployed.");
                    return [4 /*yield*/, deployments.getOrNull(ctVariant + "Proxy")];
                case 3:
                    deployedTCContract = _b.sent();
                    if (!deployedTCContract)
                        throw new Error("No ".concat(ctVariant, " deployed."));
                    return [4 /*yield*/, hardhat_1.ethers.getContractAt("MocTC", deployedTCContract.address, signer)];
                case 4:
                    CollateralToken = _b.sent();
                    return [4 /*yield*/, deployments.getOrNull("MocVendorsCARC20Proxy")];
                case 5:
                    deployedMocVendors = _b.sent();
                    if (!deployedMocVendors)
                        throw new Error("No MocVendors deployed.");
                    collateralAssetAddress = mocAddresses.collateralAssetAddress, pauserAddress = mocAddresses.pauserAddress, feeTokenAddress = mocAddresses.feeTokenAddress, feeTokenPriceProviderAddress = mocAddresses.feeTokenPriceProviderAddress, mocFeeFlowAddress = mocAddresses.mocFeeFlowAddress, mocAppreciationBeneficiaryAddress = mocAddresses.mocAppreciationBeneficiaryAddress, tcInterestCollectorAddress = mocAddresses.tcInterestCollectorAddress, maxAbsoluteOpProviderAddress = mocAddresses.maxAbsoluteOpProviderAddress, maxOpDiffProviderAddress = mocAddresses.maxOpDiffProviderAddress;
                    governorAddress = (0, exports.getGovernorAddresses)(hre);
                    if (!hre.network.tags.local) return [3 /*break*/, 14];
                    return [4 /*yield*/, deployments.deploy("CollateralAssetCARC20", {
                            contract: "ERC20Mock",
                            from: deployer,
                            gasLimit: gasLimit,
                        })];
                case 6:
                    deployedERC20MockContract = _b.sent();
                    collateralAssetAddress = deployedERC20MockContract.address;
                    return [4 /*yield*/, hardhat_1.ethers.getContractFactory("ERC20Mock")];
                case 7:
                    rc20MockFactory = _b.sent();
                    return [4 /*yield*/, rc20MockFactory.deploy()];
                case 8:
                    feeTokenAddress = (_b.sent()).address;
                    return [4 /*yield*/, hardhat_1.ethers.getContractFactory("PriceProviderMock")];
                case 9:
                    priceProviderMockFactory = _b.sent();
                    return [4 /*yield*/, priceProviderMockFactory.deploy(hardhat_1.ethers.utils.parseEther("1"))];
                case 10:
                    feeTokenPriceProviderAddress = (_b.sent()).address;
                    return [4 /*yield*/, hardhat_1.ethers.getContractFactory("DataProviderMock")];
                case 11:
                    DataProviderMockFactory = _b.sent();
                    return [4 /*yield*/, DataProviderMockFactory.deploy(utils_1.CONSTANTS.MAX_UINT256)];
                case 12:
                    maxAbsoluteOpProviderAddress = (_b.sent()).address;
                    return [4 /*yield*/, DataProviderMockFactory.deploy(utils_1.CONSTANTS.MAX_UINT256)];
                case 13:
                    maxOpDiffProviderAddress = (_b.sent()).address;
                    _b.label = 14;
                case 14: return [4 /*yield*/, (0, exports.deployUUPSArtifact)({
                        hre: hre,
                        artifactBaseName: mocCARC20Variant,
                        contract: mocCARC20Variant,
                        initializeArgs: [
                            __assign({ initializeCoreParams: {
                                    initializeBaseBucketParams: {
                                        feeTokenAddress: feeTokenAddress,
                                        feeTokenPriceProviderAddress: feeTokenPriceProviderAddress,
                                        tcTokenAddress: CollateralToken.address,
                                        mocFeeFlowAddress: mocFeeFlowAddress,
                                        mocAppreciationBeneficiaryAddress: mocAppreciationBeneficiaryAddress,
                                        protThrld: coreParams.protThrld,
                                        liqThrld: coreParams.liqThrld,
                                        feeRetainer: feeParams.feeRetainer,
                                        tcMintFee: feeParams.mintFee,
                                        tcRedeemFee: feeParams.redeemFee,
                                        swapTPforTPFee: feeParams.swapTPforTPFee,
                                        swapTPforTCFee: feeParams.swapTPforTCFee,
                                        swapTCforTPFee: feeParams.swapTCforTPFee,
                                        redeemTCandTPFee: feeParams.redeemTCandTPFee,
                                        mintTCandTPFee: feeParams.mintTCandTPFee,
                                        feeTokenPct: feeParams.feeTokenPct,
                                        successFee: coreParams.successFee,
                                        appreciationFactor: coreParams.appreciationFactor,
                                        bes: settlementParams.bes,
                                        tcInterestCollectorAddress: tcInterestCollectorAddress,
                                        tcInterestRate: coreParams.tcInterestRate,
                                        tcInterestPaymentBlockSpan: coreParams.tcInterestPaymentBlockSpan,
                                        maxAbsoluteOpProviderAddress: maxAbsoluteOpProviderAddress,
                                        maxOpDiffProviderAddress: maxOpDiffProviderAddress,
                                        decayBlockSpan: coreParams.decayBlockSpan,
                                    },
                                    governorAddress: governorAddress,
                                    pauserAddress: pauserAddress,
                                    mocCoreExpansion: deployedMocExpansionContract.address,
                                    emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
                                    mocVendors: deployedMocVendors.address,
                                }, acTokenAddress: collateralAssetAddress }, extraInitParams),
                        ],
                    })];
                case 15:
                    mocCARC20 = _b.sent();
                    console.log("Delegating CT roles to Moc");
                    // Assign TC Roles, and renounce deployer ADMIN
                    return [4 /*yield*/, (0, exports.waitForTxConfirmation)(CollateralToken.transferAllRoles(mocCARC20.address))];
                case 16:
                    // Assign TC Roles, and renounce deployer ADMIN
                    _b.sent();
                    console.log("initialization completed!");
                    if (!hre.network.tags.testnet) return [3 /*break*/, 18];
                    return [4 /*yield*/, (0, exports.addPeggedTokensAndChangeGovernor)(hre, mocAddresses.governorAddress, mocCARC20, tpParams)];
                case 17:
                    _b.sent();
                    _b.label = 18;
                case 18: return [2 /*return*/, mocCARC20];
            }
        });
    });
};
exports.deployCARC20 = deployCARC20;
//# sourceMappingURL=utils.js.map