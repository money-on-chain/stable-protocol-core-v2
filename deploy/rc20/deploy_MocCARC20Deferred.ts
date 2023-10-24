import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { deployCARC20 } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const signer = ethers.provider.getSigner();

  const deployedMocQueue = await deployments.getOrNull("MocQueueProxy");
  if (!deployedMocQueue) throw new Error("No MocQueue deployed.");

  const mocCARC20 = await deployCARC20(hre, "MocCARC20Deferred", "CollateralTokenCARC20Deferred", {
    mocQueue: deployedMocQueue.address,
  });

  const mocQueue = await ethers.getContractAt("MocQueue", deployedMocQueue.address, signer);

  // TODO: Deployer has admin privileges as this stage
  console.log(`Registering mocRC20 bucket as enqueuer: ${mocCARC20.address}`);
  await mocQueue.registerBucket(mocCARC20.address);

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocCARC20Deferred"; // id required to prevent re-execution
deployFunc.tags = ["MocCARC20Deferred"];
deployFunc.dependencies = ["CollateralTokenCARC20Deferred", "MocVendorsCARC20", "MocCARC20Expansion", "MocQueue"];
