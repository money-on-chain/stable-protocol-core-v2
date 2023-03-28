import { DeployFunction } from "hardhat-deploy/types";
import { deployCollateralToken } from "../../scripts/utils";

const deployFunc: DeployFunction = deployCollateralToken("CollateralTokenCABag");
export default deployFunc;

deployFunc.id = "deployed_CollateralTokenCABag"; // id required to prevent re-execution
deployFunc.tags = ["CollateralTokenCABag"];
