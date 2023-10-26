import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployUUPSArtifact, getGovernorAddresses } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const governorAddress = await getGovernorAddresses(hre);
  const { deployer } = await hre.getNamedAccounts();

  await deployUUPSArtifact({
    hre,
    artifactBaseName: "WrappedCollateralAsset",
    contract: "MocRC20",
    initializeArgs: [
      "WrappedCollateralAsset",
      "WCA",
      deployer, // proper Moc roles are gonna be assigned after it's deployed
      governorAddress,
    ],
  });

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_WrappedCollateralAsset"; // id required to prevent re-execution
deployFunc.tags = ["WrappedCollateralAsset"];
