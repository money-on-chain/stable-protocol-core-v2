import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const deployResult = await deploy("CollateralToken", {
    contract: "MocRC20",
    from: deployer,
    gasLimit: 4000000,
    args: ["CollateralToken", "CollateralToken"],
  });
  console.log(`MocRC20, as CollateralToken, deployed at ${deployResult.address}`);
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_CollateralToken"; // id required to prevent reexecution
deployFunc.tags = ["CollateralToken"];
