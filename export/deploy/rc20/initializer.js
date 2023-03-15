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
var hardhat_1 = require("hardhat");
var utils_1 = require("../../scripts/utils");
var deployFunc = function (hre) { return __awaiter(void 0, void 0, void 0, function () {
    var deployments, getNamedAccounts, deployer, _a, coreParams, settlementParams, feeParams, ctParams, tpParams, mocAddresses, gasLimit, signer, deployedMocContract, mocCARC20, deployedMocExpansionContract, deployedTCContract, CollateralToken, deployedMocVendors, MocVendors, collateralAssetAddress, governorAddress, pauserAddress, feeTokenAddress, feeTokenPriceProviderAddress, mocFeeFlowAddress, mocAppreciationBeneficiaryAddress, vendorsGuardianAddress, governorMockFactory, deployedERC20MockContract, rc20MockFactory, priceProviderMockFactory;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                deployments = hre.deployments, getNamedAccounts = hre.getNamedAccounts;
                return [4 /*yield*/, getNamedAccounts()];
            case 1:
                deployer = (_b.sent()).deployer;
                _a = (0, utils_1.getNetworkDeployParams)(hre), coreParams = _a.coreParams, settlementParams = _a.settlementParams, feeParams = _a.feeParams, ctParams = _a.ctParams, tpParams = _a.tpParams, mocAddresses = _a.mocAddresses, gasLimit = _a.gasLimit;
                signer = hardhat_1.ethers.provider.getSigner();
                return [4 /*yield*/, deployments.getOrNull("MocCARC20Proxy")];
            case 2:
                deployedMocContract = _b.sent();
                if (!deployedMocContract)
                    throw new Error("No MocCARC20Proxy deployed.");
                return [4 /*yield*/, hardhat_1.ethers.getContractAt("MocCARC20", deployedMocContract.address, signer)];
            case 3:
                mocCARC20 = _b.sent();
                return [4 /*yield*/, deployments.getOrNull("MocCARC20Expansion")];
            case 4:
                deployedMocExpansionContract = _b.sent();
                if (!deployedMocExpansionContract)
                    throw new Error("No MocCARC20Expansion deployed.");
                return [4 /*yield*/, deployments.getOrNull("CollateralTokenCARC20Proxy")];
            case 5:
                deployedTCContract = _b.sent();
                if (!deployedTCContract)
                    throw new Error("No CollateralTokenCARC20Proxy deployed.");
                return [4 /*yield*/, hardhat_1.ethers.getContractAt("MocTC", deployedTCContract.address, signer)];
            case 6:
                CollateralToken = _b.sent();
                return [4 /*yield*/, deployments.getOrNull("MocVendorsCARC20Proxy")];
            case 7:
                deployedMocVendors = _b.sent();
                if (!deployedMocVendors)
                    throw new Error("No MocVendors deployed.");
                return [4 /*yield*/, hardhat_1.ethers.getContractAt("MocVendors", deployedMocVendors.address, signer)];
            case 8:
                MocVendors = _b.sent();
                collateralAssetAddress = mocAddresses.collateralAssetAddress, governorAddress = mocAddresses.governorAddress, pauserAddress = mocAddresses.pauserAddress, feeTokenAddress = mocAddresses.feeTokenAddress, feeTokenPriceProviderAddress = mocAddresses.feeTokenPriceProviderAddress, mocFeeFlowAddress = mocAddresses.mocFeeFlowAddress, mocAppreciationBeneficiaryAddress = mocAddresses.mocAppreciationBeneficiaryAddress, vendorsGuardianAddress = mocAddresses.vendorsGuardianAddress;
                if (!(hre.network.tags.testnet || hre.network.tags.local)) return [3 /*break*/, 11];
                return [4 /*yield*/, hardhat_1.ethers.getContractFactory("GovernorMock")];
            case 9:
                governorMockFactory = _b.sent();
                return [4 /*yield*/, governorMockFactory.deploy()];
            case 10:
                governorAddress = (_b.sent()).address;
                _b.label = 11;
            case 11:
                if (!hre.network.tags.local) return [3 /*break*/, 17];
                return [4 /*yield*/, deployments.deploy("CollateralAssetCARC20", {
                        contract: "ERC20Mock",
                        from: deployer,
                        gasLimit: gasLimit,
                    })];
            case 12:
                deployedERC20MockContract = _b.sent();
                collateralAssetAddress = deployedERC20MockContract.address;
                return [4 /*yield*/, hardhat_1.ethers.getContractFactory("ERC20Mock")];
            case 13:
                rc20MockFactory = _b.sent();
                return [4 /*yield*/, rc20MockFactory.deploy()];
            case 14:
                feeTokenAddress = (_b.sent()).address;
                return [4 /*yield*/, hardhat_1.ethers.getContractFactory("PriceProviderMock")];
            case 15:
                priceProviderMockFactory = _b.sent();
                return [4 /*yield*/, priceProviderMockFactory.deploy(hardhat_1.ethers.utils.parseEther("1"))];
            case 16:
                feeTokenPriceProviderAddress = (_b.sent()).address;
                _b.label = 17;
            case 17:
                console.log("initializing...");
                // initializations
                return [4 /*yield*/, (0, utils_1.waitForTxConfirmation)(CollateralToken.initialize(ctParams.name, ctParams.symbol, deployedMocContract.address, mocAddresses.governorAddress, {
                        gasLimit: gasLimit,
                    }))];
            case 18:
                // initializations
                _b.sent();
                return [4 /*yield*/, (0, utils_1.waitForTxConfirmation)(MocVendors.initialize(vendorsGuardianAddress, governorAddress, pauserAddress, {
                        gasLimit: gasLimit,
                    }))];
            case 19:
                _b.sent();
                return [4 /*yield*/, (0, utils_1.waitForTxConfirmation)(mocCARC20.initialize({
                        initializeCoreParams: {
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
                            },
                            governorAddress: governorAddress,
                            pauserAddress: pauserAddress,
                            mocCoreExpansion: deployedMocExpansionContract.address,
                            emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
                            mocVendors: MocVendors.address,
                        },
                        acTokenAddress: collateralAssetAddress,
                    }, { gasLimit: gasLimit }))];
            case 20:
                _b.sent();
                console.log("initialization completed!");
                if (!hre.network.tags.testnet) return [3 /*break*/, 22];
                return [4 /*yield*/, (0, utils_1.addPeggedTokensAndChangeGovernor)(hre, mocAddresses.governorAddress, mocCARC20, tpParams)];
            case 21:
                _b.sent();
                _b.label = 22;
            case 22: return [2 /*return*/, hre.network.live]; // prevents re execution on live networks
        }
    });
}); };
exports.default = deployFunc;
deployFunc.id = "Initialized_CARC20"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCARC20"];
deployFunc.dependencies = ["MocCARC20", "CollateralTokenCARC20", "CollateralAssetCARC20", "MocVendors"];
//# sourceMappingURL=initializer.js.map