import { DeployFunction } from "hardhat-deploy/types";
import { deployQueue } from "../../scripts/utils";

const deployFunc: DeployFunction = deployQueue("MocQueueCARC20");
export default deployFunc;

deployFunc.id = "deployed_MocQueueCARC20"; // id required to prevent re-execution
deployFunc.tags = ["MocQueueCARC20"];
