import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getNetworkDeployParams, getGovernorAddresses, deployUUPSArtifact, EXECUTOR_ROLE } from "../../scripts/utils";

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

  if (hre.network.tags.local || hre.network.tags.testnet) {
    console.log(`[ONLY TESTING] Whitelisting deployer: ${deployer} as executor`);
    await mocQueueProxy.grantRole(EXECUTOR_ROLE, deployer);
  }

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocQueue"; // id required to prevent re-execution
deployFunc.tags = ["MocQueue"];
deployFunc.dependencies = [];
