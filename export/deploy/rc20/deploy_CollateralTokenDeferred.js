"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("../../scripts/utils");
var deployFunc = (0, utils_1.deployCollateralToken)("CollateralTokenCARC20Deferred");
exports.default = deployFunc;
deployFunc.id = "deployed_CollateralTokenCARC20Deferred"; // id required to prevent re-execution
deployFunc.tags = ["CollateralTokenCARC20Deferred"];
//# sourceMappingURL=deploy_CollateralTokenDeferred.js.map