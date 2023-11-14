import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getNetworkDeployParams, getGovernorAddresses, deployUUPSArtifact } from "../../scripts/utils";
import { EXECUTOR_ROLE } from "../../test/helpers/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { mocAddresses, queueParams } = getNetworkDeployParams(hre);
  const signer = ethers.provider.getSigner();

  let { pauserAddress } = mocAddresses;

  // for tests and testnet we deploy a Governor Mock
  const governorAddress = getGovernorAddresses(hre);

  const mocQueue = await deployUUPSArtifact({
    hre,
    artifactBaseName: "MocQueue",
    contract: "MocQueue",
    initializeArgs: [
      governorAddress,
      pauserAddress,
      queueParams.minOperWaitingBlk,
      queueParams.maxOperPerBatch,
      queueParams.execFeeParams,
    ],
  });

  const mocQueueProxy = await ethers.getContractAt("MocQueue", mocQueue.address, signer);

  for (let authorizedExecutor in mocAddresses.authorizedExecutors) {
    console.log(`Whitelisting queue executor: ${authorizedExecutor}`);
    await mocQueueProxy.grantRole(EXECUTOR_ROLE, authorizedExecutor);
  }

  if (hre.network.tags.local) {
    console.log(`Also whitelisting executor deployer: ${deployer}`);
    await mocQueueProxy.grantRole(EXECUTOR_ROLE, deployer);
  }

  // TODO: IMPORTANT: deployer needs to renounce to ADMIN_ROLE,
  // but if we're gonna do bucket adding by governance, init fnc needs to change.

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocQueue"; // id required to prevent re-execution
deployFunc.tags = ["MocQueue"];
deployFunc.dependencies = [];
