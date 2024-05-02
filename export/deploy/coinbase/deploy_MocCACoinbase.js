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
var hardhat_1 = require("hardhat");
var utils_1 = require("../../scripts/utils");
var deployFunc = function (hre) { return __awaiter(void 0, void 0, void 0, function () {
    var deployments, _a, coreParams, settlementParams, feeParams, tpParams, mocAddresses, signer, deployedMocExpansionContract, deployedTCContract, CollateralToken, deployedMocVendors, deployedMocQueue, pauserAddress, feeTokenAddress, feeTokenPriceProviderAddress, mocFeeFlowAddress, mocAppreciationBeneficiaryAddress, tcInterestCollectorAddress, maxAbsoluteOpProviderAddress, maxOpDiffProviderAddress, coinbaseFailedTransferFallback, governorAddress, rc20MockFactory, priceProviderMockFactory, DataProviderMockFactory, mocCACoinbase, mocCore, mocQueue;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                deployments = hre.deployments;
                _a = (0, utils_1.getNetworkDeployParams)(hre), coreParams = _a.coreParams, settlementParams = _a.settlementParams, feeParams = _a.feeParams, tpParams = _a.tpParams, mocAddresses = _a.mocAddresses;
                signer = hardhat_1.ethers.provider.getSigner();
                return [4 /*yield*/, deployments.getOrNull("MocCACoinbaseExpansion")];
            case 1:
                deployedMocExpansionContract = _b.sent();
                if (!deployedMocExpansionContract)
                    throw new Error("No MocCACoinbaseExpansion deployed.");
                return [4 /*yield*/, deployments.getOrNull("CollateralTokenCoinbaseProxy")];
            case 2:
                deployedTCContract = _b.sent();
                if (!deployedTCContract)
                    throw new Error("No CollateralTokenCoinbaseProxy deployed.");
                return [4 /*yield*/, hardhat_1.ethers.getContractAt("MocTC", deployedTCContract.address, signer)];
            case 3:
                CollateralToken = _b.sent();
                return [4 /*yield*/, deployments.getOrNull("MocVendorsCACoinbaseProxy")];
            case 4:
                deployedMocVendors = _b.sent();
                if (!deployedMocVendors)
                    throw new Error("No MocVendors deployed.");
                return [4 /*yield*/, deployments.getOrNull("MocQueueCoinbaseProxy")];
            case 5:
                deployedMocQueue = _b.sent();
                if (!deployedMocQueue)
                    throw new Error("No MocQueue deployed.");
                pauserAddress = mocAddresses.pauserAddress, feeTokenAddress = mocAddresses.feeTokenAddress, feeTokenPriceProviderAddress = mocAddresses.feeTokenPriceProviderAddress, mocFeeFlowAddress = mocAddresses.mocFeeFlowAddress, mocAppreciationBeneficiaryAddress = mocAddresses.mocAppreciationBeneficiaryAddress, tcInterestCollectorAddress = mocAddresses.tcInterestCollectorAddress, maxAbsoluteOpProviderAddress = mocAddresses.maxAbsoluteOpProviderAddress, maxOpDiffProviderAddress = mocAddresses.maxOpDiffProviderAddress, coinbaseFailedTransferFallback = mocAddresses.coinbaseFailedTransferFallback;
                return [4 /*yield*/, (0, utils_1.getGovernorAddresses)(hre)];
            case 6:
                governorAddress = _b.sent();
                if (!hre.network.tags.local) return [3 /*break*/, 14];
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
            case 14: return [4 /*yield*/, (0, utils_1.deployUUPSArtifact)({
                    hre: hre,
                    contract: "MocCACoinbase",
                    initializeArgs: [
                        {
                            initializeCoreParams: {
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
                                    allowDifferentRecipient: coreParams.allowDifferentRecipient,
                                },
                                governorAddress: governorAddress,
                                pauserAddress: pauserAddress,
                                mocCoreExpansion: deployedMocExpansionContract.address,
                                emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
                                mocVendors: deployedMocVendors.address,
                            },
                            transferMaxGas: coreParams.transferMaxGas,
                            coinbaseFailedTransferFallback: coinbaseFailedTransferFallback,
                        },
                    ],
                })];
            case 15:
                mocCACoinbase = _b.sent();
                console.log("Delegating CT roles to Moc");
                // Assign TC Roles, and renounce deployer ADMIN
                return [4 /*yield*/, (0, utils_1.waitForTxConfirmation)(CollateralToken.transferAllRoles(mocCACoinbase.address))];
            case 16:
                // Assign TC Roles, and renounce deployer ADMIN
                _b.sent();
                if (!hre.network.tags.testnet) return [3 /*break*/, 19];
                return [4 /*yield*/, hardhat_1.ethers.getContractAt("MocCACoinbase", mocCACoinbase.address, signer)];
            case 17:
                mocCore = _b.sent();
                return [4 /*yield*/, (0, utils_1.addPeggedTokensAndChangeGovernor)(hre, mocAddresses.governorAddress, mocCore, tpParams)];
            case 18:
                _b.sent();
                _b.label = 19;
            case 19:
                if (!hre.network.tags.local) return [3 /*break*/, 22];
                return [4 /*yield*/, hardhat_1.ethers.getContractAt("MocQueue", deployedMocQueue.address, signer)];
            case 20:
                mocQueue = _b.sent();
                console.log("Registering mocCoinbase bucket as enqueuer: ".concat(mocCACoinbase.address));
                return [4 /*yield*/, mocQueue.registerBucket(mocCACoinbase.address)];
            case 21:
                _b.sent();
                _b.label = 22;
            case 22: return [2 /*return*/, hre.network.live]; // prevents re execution on live networks
        }
    });
}); };
exports.default = deployFunc;
deployFunc.id = "deployed_MocCACoinbase"; // id required to prevent re-execution
deployFunc.tags = ["MocCACoinbase"];
deployFunc.dependencies = [
    "CollateralTokenCoinbase",
    "MocVendorsCACoinbase",
    "MocCACoinbaseExpansion",
    "MocQueueCoinbase",
];
//# sourceMappingURL=deploy_MocCACoinbase.js.map