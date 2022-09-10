import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const deployResult = await deploy("CollateralToken", {
    contract: "MocTC",
    from: deployer,
    gasLimit: 4000000,
    args: ["CollateralToken", "CollateralToken"],
  });
  console.log(`MocTC, as CollateralToken, deployed at ${deployResult.address}`);
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_CollateralToken"; // id required to prevent re-execution
deployFunc.tags = ["CollateralToken"];
