import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { GAS_LIMIT_PATCH } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const deployedMocContract = await deployments.getOrNull("MocCARC20Proxy");
  if (!deployedMocContract) throw new Error("No MocCARC20Proxy deployed.");

  const deployResult = await deploy("CollateralTokenCARC20", {
    contract: "MocTC",
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
    args: ["CollateralToken", "CollateralToken", deployedMocContract.address],
  });
  console.log(`MocCT, as CollateralTokenCARC20, deployed at ${deployResult.address}`);
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_CollateralTokenCARC20"; // id required to prevent re-execution
deployFunc.tags = ["CollateralTokenCARC20"];
deployFunc.dependencies = ["MocCARC20"];
