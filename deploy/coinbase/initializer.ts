import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { MocRC20, MocRC20__factory, MocCACoinbase, MocCACoinbase__factory } from "../../typechain";
import { GAS_LIMIT_PATCH, MINTER_ROLE, BURNER_ROLE, waitForTxConfirmation } from "../../scripts/utils";
import { coreParams, tcParams, mocAddresses } from "../../deploy-config/config";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const network = hre.network.name as keyof typeof mocAddresses;
  const signer = ethers.provider.getSigner();

  const deployedMocContractProxy = await deployments.getOrNull("MocCACoinbaseProxy");
  if (!deployedMocContractProxy) throw new Error("No MocCACoinbaseProxy deployed.");
  const MocCACoinbase: MocCACoinbase = MocCACoinbase__factory.connect(deployedMocContractProxy.address, signer);

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbase");
  if (!deployedTCContract) throw new Error("No CollateralTokenCoinbase deployed.");
  const CollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

  const { governor, stopper, mocFeeFlowAddress } = mocAddresses[network];
  // initializations
  await waitForTxConfirmation(
    MocCACoinbase.initialize(
      governor,
      stopper,
      CollateralToken.address,
      mocFeeFlowAddress,
      coreParams.ctarg,
      coreParams.protThrld,
      tcParams.mintFee,
      tcParams.redeemFee,
      { gasLimit: GAS_LIMIT_PATCH },
    ),
  );

  // set minter and burner roles
  await Promise.all(
    [MINTER_ROLE, BURNER_ROLE].map(role =>
      waitForTxConfirmation(CollateralToken.grantRole(role, MocCACoinbase.address, { gasLimit: GAS_LIMIT_PATCH })),
    ),
  );

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_Coinbase"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCoinbase"];
deployFunc.dependencies = ["MocCACoinbase", "CollateralTokenCoinbase"];
