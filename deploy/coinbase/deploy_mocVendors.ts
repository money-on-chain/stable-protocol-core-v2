import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployUUPSArtifact } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  await deployUUPSArtifact({ hre, artifactBaseName: "MocVendorsCACoinbase", contract: "MocVendors" });
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocVendorsCACoinbase"; // id required to prevent re-execution
deployFunc.tags = ["MocVendorsCACoinbase"];
