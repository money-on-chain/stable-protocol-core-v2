import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { deployUUPSArtifact } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  await deployUUPSArtifact({ hre, contract: "MocSettlement", artifactBaseName: "MocSettlementCACoinbase" });
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocSettlementCACoinbase"; // id required to prevent re-execution
deployFunc.tags = ["MocSettlementCACoinbase"];
