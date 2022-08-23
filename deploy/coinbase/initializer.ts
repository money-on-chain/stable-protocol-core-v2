import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { MocRC20, MocRC20__factory, MocCACoinbase, MocCACoinbase__factory } from "../../typechain";
import { GAS_LIMIT_PATCH, waitForTxConfirmation } from "../../scripts/utils";
import { coreParams, tcParams } from "../../deploy-config/config";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer, mocFeeFlow } = await getNamedAccounts();
  const signer = ethers.provider.getSigner();

  const deployedMocContract = await deployments.getOrNull("MocCACoinbase");
  if (deployedMocContract == undefined) throw new Error("No Moc deployed.");
  const MocCore: MocCACoinbase = MocCACoinbase__factory.connect(deployedMocContract.address, signer);

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbase");
  if (deployedTCContract == undefined) throw new Error("No CollateralToken deployed.");
  const CollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

  // initializations
  await waitForTxConfirmation(
    MocCore.initialize(
      CollateralToken.address,
      mocFeeFlow,
      coreParams.ctarg,
      coreParams.protThrld,
      tcParams.mintFee,
      tcParams.redeemFee,
      { gasLimit: GAS_LIMIT_PATCH },
    ),
  );

  // set minter and burner roles
  const minterRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
  const burnerRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BURNER_ROLE"));

  await waitForTxConfirmation(CollateralToken.grantRole(minterRole, MocCore.address, { gasLimit: GAS_LIMIT_PATCH }));
  await waitForTxConfirmation(CollateralToken.renounceRole(minterRole, deployer, { gasLimit: GAS_LIMIT_PATCH }));
  await waitForTxConfirmation(CollateralToken.grantRole(burnerRole, MocCore.address, { gasLimit: GAS_LIMIT_PATCH }));
  await waitForTxConfirmation(CollateralToken.renounceRole(burnerRole, deployer, { gasLimit: GAS_LIMIT_PATCH }));

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_Coinbase"; // id required to prevent reexecution
deployFunc.tags = ["InitializerCoinbase"];
deployFunc.runAtTheEnd = true;
