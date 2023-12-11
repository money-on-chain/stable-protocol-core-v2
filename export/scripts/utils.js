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
exports.deployCARC20 = exports.addPeggedTokensAndChangeGovernor = exports.getNetworkDeployParams = exports.deployVendors = exports.getGovernorAddresses = exports.deployQueue = exports.deployCollateralToken = exports.deployUUPSArtifact = exports.waitForTxConfirmation = exports.ENQUEUER_ROLE = exports.EXECUTOR_ROLE = exports.PAUSER_ROLE = exports.BURNER_ROLE = exports.MINTER_ROLE = exports.DEFAULT_ADMIN_ROLE = exports.CONSTANTS = void 0;
var hardhat_1 = require("hardhat");
var bignumber_1 = require("@ethersproject/bignumber");
exports.CONSTANTS = {
    ZERO_ADDRESS: hardhat_1.ethers.constants.AddressZero,
    MAX_UINT256: hardhat_1.ethers.constants.MaxUint256,
    MAX_BALANCE: hardhat_1.ethers.constants.MaxUint256.div((1e17).toString()),
    PRECISION: bignumber_1.BigNumber.from((1e18).toString()),
    ONE: bignumber_1.BigNumber.from((1e18).toString()),
};
exports.DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
exports.MINTER_ROLE = hardhat_1.ethers.utils.keccak256(hardhat_1.ethers.utils.toUtf8Bytes("MINTER_ROLE"));
exports.BURNER_ROLE = hardhat_1.ethers.utils.keccak256(hardhat_1.ethers.utils.toUtf8Bytes("BURNER_ROLE"));
exports.PAUSER_ROLE = hardhat_1.ethers.utils.keccak256(hardhat_1.ethers.utils.toUtf8Bytes("PAUSER_ROLE"));
exports.EXECUTOR_ROLE = hardhat_1.ethers.utils.keccak256(hardhat_1.ethers.utils.toUtf8Bytes("EXECUTOR_ROLE"));
exports.ENQUEUER_ROLE = hardhat_1.ethers.utils.keccak256(hardhat_1.ethers.utils.toUtf8Bytes("ENQUEUER_ROLE"));
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
                                proxyContract: "ERC1967Proxy",
                                proxyArgs: ["{implementation}", "{data}"],
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
                return [4 /*yield*/, (0, exports.getGovernorAddresses)(hre)];
            case 1:
                governorAddress = _a.sent();
                return [4 /*yield*/, hre.getNamedAccounts()];
            case 2:
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
            case 3:
                _a.sent();
                return [2 /*return*/, hre.network.live]; // prevents re execution on live networks
        }
    });
}); }; };
exports.deployCollateralToken = deployCollateralToken;
var deployQueue = function (artifactBaseName) { return function (hre) { return __awaiter(void 0, void 0, void 0, function () {
    var getNamedAccounts, deployer, _a, queueParams, mocAddresses, governorAddress, signer, mocQueue, mocQueueProxy;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                getNamedAccounts = hre.getNamedAccounts;
                return [4 /*yield*/, getNamedAccounts()];
            case 1:
                deployer = (_b.sent()).deployer;
                _a = (0, exports.getNetworkDeployParams)(hre), queueParams = _a.queueParams, mocAddresses = _a.mocAddresses;
                governorAddress = (0, exports.getGovernorAddresses)(hre);
                signer = hardhat_1.ethers.provider.getSigner();
                return [4 /*yield*/, (0, exports.deployUUPSArtifact)({
                        hre: hre,
                        artifactBaseName: artifactBaseName,
                        contract: "MocQueue",
                        initializeArgs: [
                            governorAddress,
                            mocAddresses.pauserAddress,
                            queueParams.minOperWaitingBlk,
                            queueParams.maxOperPerBatch,
                            queueParams.execFeeParams,
                        ],
                    })];
            case 2:
                mocQueue = _b.sent();
                if (!(hre.network.tags.local || hre.network.tags.testnet)) return [3 /*break*/, 5];
                console.log("[ONLY TESTING] Whitelisting deployer: ".concat(deployer, " as executor"));
                return [4 /*yield*/, hardhat_1.ethers.getContractAt("MocQueue", mocQueue.address, signer)];
            case 3:
                mocQueueProxy = _b.sent();
                return [4 /*yield*/, mocQueueProxy.grantRole(exports.EXECUTOR_ROLE, deployer)];
            case 4:
                _b.sent();
                _b.label = 5;
            case 5: return [2 /*return*/, hre.network.live]; // prevents re execution on live networks
        }
    });
}); }; };
exports.deployQueue = deployQueue;
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
                console.log("[ONLY TESTING] Using GovernorMock:", deployResult.address);
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
    var gasLimit, deployments, i, mocRC20TP, signer, mocRC20Proxy;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                gasLimit = (0, exports.getNetworkDeployParams)(hre).gasLimit;
                if (!tpParams) return [3 /*break*/, 8];
                deployments = hre.deployments;
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
                signer = hardhat_1.ethers.provider.getSigner();
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
        var deployments, getNamedAccounts, deployer, _a, coreParams, settlementParams, feeParams, tpParams, mocAddresses, gasLimit, signer, deployedMocExpansionContract, deployedTCContract, CollateralToken, deployedMocVendors, deployedMocQueue, collateralAssetAddress, pauserAddress, feeTokenAddress, feeTokenPriceProviderAddress, mocFeeFlowAddress, mocAppreciationBeneficiaryAddress, tcInterestCollectorAddress, maxAbsoluteOpProviderAddress, maxOpDiffProviderAddress, governorAddress, deployedERC20MockContract, rc20MockFactory, priceProviderMockFactory, DataProviderMockFactory, mocCARC20, mocQueue;
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
                    return [4 /*yield*/, deployments.getOrNull("MocQueueCARC20Proxy")];
                case 6:
                    deployedMocQueue = _b.sent();
                    if (!deployedMocQueue)
                        throw new Error("No MocQueue deployed.");
                    collateralAssetAddress = mocAddresses.collateralAssetAddress, pauserAddress = mocAddresses.pauserAddress, feeTokenAddress = mocAddresses.feeTokenAddress, feeTokenPriceProviderAddress = mocAddresses.feeTokenPriceProviderAddress, mocFeeFlowAddress = mocAddresses.mocFeeFlowAddress, mocAppreciationBeneficiaryAddress = mocAddresses.mocAppreciationBeneficiaryAddress, tcInterestCollectorAddress = mocAddresses.tcInterestCollectorAddress, maxAbsoluteOpProviderAddress = mocAddresses.maxAbsoluteOpProviderAddress, maxOpDiffProviderAddress = mocAddresses.maxOpDiffProviderAddress;
                    governorAddress = (0, exports.getGovernorAddresses)(hre);
                    if (!hre.network.tags.local) return [3 /*break*/, 15];
                    return [4 /*yield*/, deployments.deploy("CollateralAssetCARC20", {
                            contract: "ERC20Mock",
                            from: deployer,
                            gasLimit: gasLimit,
                        })];
                case 7:
                    deployedERC20MockContract = _b.sent();
                    collateralAssetAddress = deployedERC20MockContract.address;
                    return [4 /*yield*/, hardhat_1.ethers.getContractFactory("ERC20Mock")];
                case 8:
                    rc20MockFactory = _b.sent();
                    return [4 /*yield*/, rc20MockFactory.deploy()];
                case 9:
                    feeTokenAddress = (_b.sent()).address;
                    return [4 /*yield*/, hardhat_1.ethers.getContractFactory("PriceProviderMock")];
                case 10:
                    priceProviderMockFactory = _b.sent();
                    return [4 /*yield*/, priceProviderMockFactory.deploy(hardhat_1.ethers.utils.parseEther("1"))];
                case 11:
                    feeTokenPriceProviderAddress = (_b.sent()).address;
                    return [4 /*yield*/, hardhat_1.ethers.getContractFactory("DataProviderMock")];
                case 12:
                    DataProviderMockFactory = _b.sent();
                    return [4 /*yield*/, DataProviderMockFactory.deploy(exports.CONSTANTS.MAX_UINT256)];
                case 13:
                    maxAbsoluteOpProviderAddress = (_b.sent()).address;
                    return [4 /*yield*/, DataProviderMockFactory.deploy(exports.CONSTANTS.MAX_UINT256)];
                case 14:
                    maxOpDiffProviderAddress = (_b.sent()).address;
                    _b.label = 15;
                case 15: return [4 /*yield*/, (0, exports.deployUUPSArtifact)({
                        hre: hre,
                        artifactBaseName: mocCARC20Variant,
                        contract: mocCARC20Variant,
                        initializeArgs: [
                            __assign({ initializeCoreParams: {
                                    initializeBaseBucketParams: {
                                        mocQueueAddress: deployedMocQueue.address,
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
                case 16:
                    mocCARC20 = _b.sent();
                    console.log("Delegating CT roles to Moc");
                    // Assign TC Roles, and renounce deployer ADMIN
                    return [4 /*yield*/, (0, exports.waitForTxConfirmation)(CollateralToken.transferAllRoles(mocCARC20.address))];
                case 17:
                    // Assign TC Roles, and renounce deployer ADMIN
                    _b.sent();
                    console.log("initialization completed!");
                    if (!hre.network.tags.testnet) return [3 /*break*/, 19];
                    return [4 /*yield*/, (0, exports.addPeggedTokensAndChangeGovernor)(hre, mocAddresses.governorAddress, mocCARC20, tpParams)];
                case 18:
                    _b.sent();
                    _b.label = 19;
                case 19:
                    if (!hre.network.tags.local) return [3 /*break*/, 22];
                    return [4 /*yield*/, hardhat_1.ethers.getContractAt("MocQueue", deployedMocQueue.address, signer)];
                case 20:
                    mocQueue = _b.sent();
                    console.log("Registering MocRC20 bucket as enqueuer: ".concat(mocCARC20.address));
                    return [4 /*yield*/, mocQueue.registerBucket(mocCARC20.address)];
                case 21:
                    _b.sent();
                    _b.label = 22;
                case 22: return [2 /*return*/, mocCARC20];
            }
        });
    });
};
exports.deployCARC20 = deployCARC20;
//# sourceMappingURL=utils.js.map