import { DeployFunction } from "hardhat-deploy/types";
import { deployQueue } from "../../scripts/utils";

const deployFunc: DeployFunction = deployQueue("MocQueueCoinbase");
export default deployFunc;

deployFunc.id = "deployed_MocQueueCoinbase"; // id required to prevent re-execution
deployFunc.tags = ["MocQueueCoinbase"];
