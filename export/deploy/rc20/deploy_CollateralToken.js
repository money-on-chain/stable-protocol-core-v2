"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("../../scripts/utils");
var deployFunc = (0, utils_1.deployCollateralToken)("CollateralTokenCARC20");
exports.default = deployFunc;
deployFunc.id = "deployed_CollateralTokenCARC20"; // id required to prevent re-execution
deployFunc.tags = ["CollateralTokenCARC20"];
//# sourceMappingURL=deploy_CollateralToken.js.map