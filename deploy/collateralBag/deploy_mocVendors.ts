import { DeployFunction } from "hardhat-deploy/types";
import { deployVendors } from "../../scripts/utils";

const deployFunc: DeployFunction = deployVendors("MocVendorsCABag");
export default deployFunc;

deployFunc.id = "deployed_MocVendorsCABag"; // id required to prevent re-execution
deployFunc.tags = ["MocVendorsCABag"];
