import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getNetworkDeployParams, deployCARC20 } from "../../scripts/utils";
import { DEFAULT_ADMIN_ROLE, EXECUTOR_ROLE } from "../../test/helpers/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { mocAddresses } = getNetworkDeployParams(hre);
  const signer = ethers.provider.getSigner();

  const mocCARC20 = await deployCARC20(hre, "MocCARC20Deferred", "CollateralTokenCARC20Deferred");

  console.log("Whitelisting executors");
  const mocRC20Proxy = await ethers.getContractAt("MocCARC20Deferred", mocCARC20.address, signer);

  for (let authorizedExecutor in mocAddresses.authorizedExecutors) {
    console.log(`Whitelisting executor: ${authorizedExecutor}`);
    await mocRC20Proxy.grantRole(EXECUTOR_ROLE, authorizedExecutor);
  }

  if (hre.network.tags.local) {
    console.log(`Whitelisting executor deployer: ${deployer}`);
    await mocRC20Proxy.grantRole(EXECUTOR_ROLE, deployer);
  }
  // Executor Role admin is reserved for Governance
  await mocRC20Proxy.renounceRole(DEFAULT_ADMIN_ROLE, deployer);

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocCARC20Deferred"; // id required to prevent re-execution
deployFunc.tags = ["MocCARC20Deferred"];
deployFunc.dependencies = ["CollateralTokenCARC20Deferred", "MocVendorsCARC20", "MocCARC20Expansion"];
