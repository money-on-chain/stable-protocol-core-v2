"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("../../scripts/utils");
var deployFunc = (0, utils_1.deployQueue)("MocQueueCoinbase");
exports.default = deployFunc;
deployFunc.id = "deployed_MocQueueCoinbase"; // id required to prevent re-execution
deployFunc.tags = ["MocQueueCoinbase"];
//# sourceMappingURL=deploy_MocQueue.js.map