import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployUUPSArtifact } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  await deployUUPSArtifact({ hre, artifactBaseName: "MocVendorsCARC20", contract: "MocVendors" });
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocVendorsCARC20"; // id required to prevent re-execution
deployFunc.tags = ["MocVendorsCARC20"];
