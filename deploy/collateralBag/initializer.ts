import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  MocRC20,
  MocRC20__factory,
  MocCARC20,
  MocCARC20__factory,
  MocCAWrapper,
  MocCAWrapper__factory,
} from "../../typechain";
import { GAS_LIMIT_PATCH, MINTER_ROLE, BURNER_ROLE, waitForTxConfirmation } from "../../scripts/utils";
import { coreParams, tcParams, mocAddresses } from "../../deploy-config/config";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const network = hre.network.name as keyof typeof mocAddresses;
  const signer = ethers.provider.getSigner();

  const deployedMocContract = await deployments.getOrNull("MocCABagProxy");
  if (!deployedMocContract) throw new Error("No MocCABagProxy deployed.");
  const mocCARC20: MocCARC20 = MocCARC20__factory.connect(deployedMocContract.address, signer);

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCARBag");
  if (!deployedTCContract) throw new Error("No CollateralTokenCARBag deployed.");
  const CollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

  const deployedMocCAWrapperContract = await deployments.getOrNull("MocCAWrapperProxy");
  if (!deployedMocCAWrapperContract) throw new Error("No MocCAWrapper deployed.");
  const MocCAWrapper: MocCAWrapper = MocCAWrapper__factory.connect(deployedMocCAWrapperContract.address, signer);

  const deployedWCAContract = await deployments.getOrNull("WrappedCollateralAsset");
  if (!deployedWCAContract) throw new Error("No WrappedCollateralAsset deployed.");
  const WCAToken: MocRC20 = MocRC20__factory.connect(deployedWCAContract.address, signer);

  const { governor, stopper, mocFeeFlowAddress } = mocAddresses[network];
  // initializations
  await waitForTxConfirmation(
    mocCARC20.initialize(
      governor,
      stopper,
      WCAToken.address,
      CollateralToken.address,
      mocFeeFlowAddress,
      coreParams.ctarg,
      coreParams.protThrld,
      tcParams.mintFee,
      tcParams.redeemFee,
      { gasLimit: GAS_LIMIT_PATCH },
    ),
  );

  await waitForTxConfirmation(
    MocCAWrapper.initialize(governor, stopper, mocCARC20.address, WCAToken.address, { gasLimit: GAS_LIMIT_PATCH }),
  );

  // set minter and burner roles
  await Promise.all(
    [MINTER_ROLE, BURNER_ROLE].map(role =>
      waitForTxConfirmation(CollateralToken.grantRole(role, mocCARC20.address, { gasLimit: GAS_LIMIT_PATCH })),
    ),
  );
  await Promise.all(
    [MINTER_ROLE, BURNER_ROLE].map(role =>
      waitForTxConfirmation(WCAToken.grantRole(role, MocCAWrapper.address, { gasLimit: GAS_LIMIT_PATCH })),
    ),
  );

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_CARBag"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCARBag"];
deployFunc.dependencies = ["MocCABag", "CollateralTokenCARBag", "MocCAWrapper", "WrappedCollateralAsset"];
