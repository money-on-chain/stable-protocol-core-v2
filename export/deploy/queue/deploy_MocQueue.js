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
var utils_2 = require("../../test/helpers/utils");
var deployFunc = function (hre) { return __awaiter(void 0, void 0, void 0, function () {
    var getNamedAccounts, deployer, _a, mocAddresses, queueParams, signer, pauserAddress, governorAddress, mocQueue, mocQueueProxy, _b, _c, _d, _i, authorizedExecutor;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                getNamedAccounts = hre.getNamedAccounts;
                return [4 /*yield*/, getNamedAccounts()];
            case 1:
                deployer = (_e.sent()).deployer;
                _a = (0, utils_1.getNetworkDeployParams)(hre), mocAddresses = _a.mocAddresses, queueParams = _a.queueParams;
                signer = hardhat_1.ethers.provider.getSigner();
                pauserAddress = mocAddresses.pauserAddress;
                governorAddress = (0, utils_1.getGovernorAddresses)(hre);
                return [4 /*yield*/, (0, utils_1.deployUUPSArtifact)({
                        hre: hre,
                        artifactBaseName: "MocQueue",
                        contract: "MocQueue",
                        initializeArgs: [governorAddress, pauserAddress, queueParams.minOperWaitingBlk, queueParams.execFeeParams],
                    })];
            case 2:
                mocQueue = _e.sent();
                return [4 /*yield*/, hardhat_1.ethers.getContractAt("MocQueue", mocQueue.address, signer)];
            case 3:
                mocQueueProxy = _e.sent();
                _b = mocAddresses.authorizedExecutors;
                _c = [];
                for (_d in _b)
                    _c.push(_d);
                _i = 0;
                _e.label = 4;
            case 4:
                if (!(_i < _c.length)) return [3 /*break*/, 7];
                _d = _c[_i];
                if (!(_d in _b)) return [3 /*break*/, 6];
                authorizedExecutor = _d;
                console.log("Whitelisting queue executor: ".concat(authorizedExecutor));
                return [4 /*yield*/, mocQueueProxy.grantRole(utils_2.EXECUTOR_ROLE, authorizedExecutor)];
            case 5:
                _e.sent();
                _e.label = 6;
            case 6:
                _i++;
                return [3 /*break*/, 4];
            case 7:
                if (!hre.network.tags.local) return [3 /*break*/, 9];
                console.log("Also whitelisting executor deployer: ".concat(deployer));
                return [4 /*yield*/, mocQueueProxy.grantRole(utils_2.EXECUTOR_ROLE, deployer)];
            case 8:
                _e.sent();
                _e.label = 9;
            case 9: 
            // TODO: IMPORTANT: deployer needs to renounce to ADMIN_ROLE,
            // but if we're gonna do bucket adding by governance, init fnc needs to change.
            return [2 /*return*/, hre.network.live]; // prevents re execution on live networks
        }
    });
}); };
exports.default = deployFunc;
deployFunc.id = "deployed_MocQueue"; // id required to prevent re-execution
deployFunc.tags = ["MocQueue"];
deployFunc.dependencies = [];
//# sourceMappingURL=deploy_MocQueue.js.map