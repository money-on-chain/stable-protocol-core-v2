import { DeployFunction } from "hardhat-deploy/types";
import { deployCollateralToken } from "../../scripts/utils";

const deployFunc: DeployFunction = deployCollateralToken("CollateralTokenCARC20Deferred");
export default deployFunc;

deployFunc.id = "deployed_CollateralTokenCARC20Deferred"; // id required to prevent re-execution
deployFunc.tags = ["CollateralTokenCARC20Deferred"];
