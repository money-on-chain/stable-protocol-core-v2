import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const deployResult = await deploy("MocToken", {
    contract: "MocRC20",
    from: deployer,
    gasLimit: 4000000,
    args: ["MocToken", "MocToken"],
  });
  console.log(`MocRC20, as MocToken, deployed at ${deployResult.address}`);
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocToken"; // id required to prevent reexecution
deployFunc.tags = ["MocToken"];
