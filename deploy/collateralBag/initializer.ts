import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  MocRC20,
  MocRC20__factory,
  MocCARBag,
  MocCARBag__factory,
  MocCAWrapper,
  MocCAWrapper__factory,
} from "../../typechain";
import { GAS_LIMIT_PATCH, MINTER_ROLE, BURNER_ROLE, waitForTxConfirmation } from "../../scripts/utils";
import { coreParams, tcParams, mocAddresses } from "../../deploy-config/config";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const network = hre.network.name as keyof typeof mocAddresses;
  const signer = ethers.provider.getSigner();

  const deployedMocContract = await deployments.getOrNull("MocCARBag");
  if (!deployedMocContract) throw new Error("No MocCARBag deployed.");
  const MocCore: MocCARBag = MocCARBag__factory.connect(deployedMocContract.address, signer);

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCARBag");
  if (!deployedTCContract) throw new Error("No CollateralTokenCARBag deployed.");
  const CollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

  const deployedMocCAWrapperContract = await deployments.getOrNull("MocCAWrapper");
  if (!deployedMocCAWrapperContract) throw new Error("No MocCAWrapper deployed.");
  const MocCAWrapper: MocCAWrapper = MocCAWrapper__factory.connect(deployedMocCAWrapperContract.address, signer);

  const deployedWCAContract = await deployments.getOrNull("WrappedCollateralAsset");
  if (!deployedWCAContract) throw new Error("No WrappedCollateralAsset deployed.");
  const WCAToken: MocRC20 = MocRC20__factory.connect(deployedWCAContract.address, signer);

  // initializations
  await waitForTxConfirmation(
    MocCore.initialize(
      WCAToken.address,
      CollateralToken.address,
      mocAddresses[network].mocFeeFlowAddress,
      coreParams.ctarg,
      coreParams.protThrld,
      tcParams.mintFee,
      tcParams.redeemFee,
      { gasLimit: GAS_LIMIT_PATCH },
    ),
  );

  await waitForTxConfirmation(
    MocCAWrapper.initialize(MocCore.address, WCAToken.address, { gasLimit: GAS_LIMIT_PATCH }),
  );

  // set minter and burner roles
  await waitForTxConfirmation(CollateralToken.grantRole(MINTER_ROLE, MocCore.address, { gasLimit: GAS_LIMIT_PATCH }));
  await waitForTxConfirmation(CollateralToken.grantRole(BURNER_ROLE, MocCore.address, { gasLimit: GAS_LIMIT_PATCH }));

  // set minter and burner roles
  await waitForTxConfirmation(WCAToken.grantRole(MINTER_ROLE, MocCAWrapper.address, { gasLimit: GAS_LIMIT_PATCH }));
  await waitForTxConfirmation(WCAToken.grantRole(BURNER_ROLE, MocCAWrapper.address, { gasLimit: GAS_LIMIT_PATCH }));

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_CARBag"; // id required to prevent reexecution
deployFunc.tags = ["InitializerCARBag"];
deployFunc.dependencies = ["MocCARBag", "CollateralTokenCARBag", "MocCAWrapperContract", "WrappedCollateralAsset"];
