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
    var deployments, getNamedAccounts, deployer, _a, coreParams, settlementParams, feeParams, ctParams, tpParams, mocAddresses, gasLimit, signer, deployedMocContract, mocCARC20, deployedTCContract, CollateralToken, collateralAssetToken, governorAddress, pauserAddress, mocFeeFlowAddress, mocAppreciationBeneficiaryAddress, governorMockFactory, deployedERC20MockContract;
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
                return [4 /*yield*/, deployments.getOrNull("CollateralTokenCARC20Proxy")];
            case 4:
                deployedTCContract = _b.sent();
                if (!deployedTCContract)
                    throw new Error("No CollateralTokenCARC20Proxy deployed.");
                return [4 /*yield*/, hardhat_1.ethers.getContractAt("MocTC", deployedTCContract.address, signer)];
            case 5:
                CollateralToken = _b.sent();
                collateralAssetToken = "";
                governorAddress = mocAddresses.governorAddress, pauserAddress = mocAddresses.pauserAddress, mocFeeFlowAddress = mocAddresses.mocFeeFlowAddress, mocAppreciationBeneficiaryAddress = mocAddresses.mocAppreciationBeneficiaryAddress;
                if (!(hre.network.tags.testnet || hre.network.tags.local)) return [3 /*break*/, 9];
                return [4 /*yield*/, hardhat_1.ethers.getContractFactory("GovernorMock")];
            case 6:
                governorMockFactory = _b.sent();
                return [4 /*yield*/, governorMockFactory.deploy()];
            case 7:
                governorAddress = (_b.sent()).address;
                return [4 /*yield*/, deployments.deploy("CollateralAssetCARC20", {
                        contract: "ERC20Mock",
                        from: deployer,
                        gasLimit: gasLimit,
                    })];
            case 8:
                deployedERC20MockContract = _b.sent();
                collateralAssetToken = deployedERC20MockContract.address;
                _b.label = 9;
            case 9:
                console.log("initializing...");
                // initializations
                return [4 /*yield*/, (0, utils_1.waitForTxConfirmation)(CollateralToken.initialize(ctParams.name, ctParams.symbol, deployedMocContract.address, mocAddresses.governorAddress, {
                        gasLimit: gasLimit,
                    }))];
            case 10:
                // initializations
                _b.sent();
                return [4 /*yield*/, (0, utils_1.waitForTxConfirmation)(mocCARC20.initialize({
                        initializeCoreParams: {
                            initializeBaseBucketParams: {
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
                                successFee: coreParams.successFee,
                                appreciationFactor: coreParams.appreciationFactor,
                            },
                            governorAddress: governorAddress,
                            pauserAddress: pauserAddress,
                            emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
                            bes: settlementParams.bes,
                        },
                        acTokenAddress: collateralAssetToken,
                    }, { gasLimit: gasLimit }))];
            case 11:
                _b.sent();
                console.log("initialization completed!");
                if (!hre.network.tags.testnet) return [3 /*break*/, 13];
                return [4 /*yield*/, (0, utils_1.addPeggedTokensAndChangeGovernor)(hre, mocAddresses.governorAddress, mocCARC20, tpParams)];
            case 12:
                _b.sent();
                _b.label = 13;
            case 13: return [2 /*return*/, hre.network.live]; // prevents re execution on live networks
        }
    });
}); };
exports.default = deployFunc;
deployFunc.id = "Initialized_CARC20"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCARC20"];
deployFunc.dependencies = ["MocCARC20", "CollateralTokenCARC20", "CollateralAssetCARC20"];
//# sourceMappingURL=initializer.js.map