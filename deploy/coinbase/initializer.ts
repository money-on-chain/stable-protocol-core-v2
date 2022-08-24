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

  const deployedMocContract = await deployments.getOrNull("MocCACoinbase");
  if (!deployedMocContract) throw new Error("No Moc deployed.");
  const MocCore: MocCACoinbase = MocCACoinbase__factory.connect(deployedMocContract.address, signer);

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbase");
  if (!deployedTCContract) throw new Error("No CollateralToken deployed.");
  const CollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

  // initializations
  await waitForTxConfirmation(
    MocCore.initialize(
      CollateralToken.address,
      mocAddresses[network].mocFeeFlowAddress,
      coreParams.ctarg,
      coreParams.protThrld,
      tcParams.mintFee,
      tcParams.redeemFee,
      { gasLimit: GAS_LIMIT_PATCH },
    ),
  );

  // set minter and burner roles
  await waitForTxConfirmation(CollateralToken.grantRole(MINTER_ROLE, MocCore.address, { gasLimit: GAS_LIMIT_PATCH }));
  await waitForTxConfirmation(CollateralToken.grantRole(BURNER_ROLE, MocCore.address, { gasLimit: GAS_LIMIT_PATCH }));

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_Coinbase"; // id required to prevent reexecution
deployFunc.tags = ["InitializerCoinbase"];
deployFunc.dependencies = ["MocCACoinbase", "CollateralTokenCoinbase"];
