import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployUUPSArtifact } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  await deployUUPSArtifact({ hre, artifactBaseName: "CollateralTokenCARC20", contract: "MocTC" });

  await deployUUPSArtifact({ hre, contract: "MocCARC20" });
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocCARC20"; // id required to prevent re-execution
deployFunc.tags = ["MocCARC20"];
