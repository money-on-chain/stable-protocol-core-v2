import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployUUPSArtifact } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  await deployUUPSArtifact(hre, "CollateralTokenCoinbase", "MocTC");
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_CollateralTokenCoinbase"; // id required to prevent re-execution
deployFunc.tags = ["CollateralTokenCoinbase"];
