import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { GAS_LIMIT_PATCH } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const deployedMocCAWrapperContract = await deployments.getOrNull("MocCAWrapperProxy");
  if (!deployedMocCAWrapperContract) throw new Error("No MocCAWrapper deployed.");

  const deployResult = await deploy("WrappedCollateralAsset", {
    contract: "MocRC20",
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
    args: ["WrappedCollateralAsset", "WCA", deployedMocCAWrapperContract.address],
  });
  console.log(`MocRC20, as WrappedCollateralAsset, deployed at ${deployResult.address}`);
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_WrappedCollateralAsset"; // id required to prevent re-execution
deployFunc.tags = ["WrappedCollateralAsset"];
deployFunc.dependencies = ["MocCAWrapper"];
