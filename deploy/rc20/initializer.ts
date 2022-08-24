import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { MocRC20, MocRC20__factory, MocCARC20, MocCARC20__factory } from "../../typechain";
import { GAS_LIMIT_PATCH, MINTER_ROLE, BURNER_ROLE, waitForTxConfirmation } from "../../scripts/utils";
import { coreParams, tcParams, mocAddresses } from "../../deploy-config/config";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const network = hre.network.name as keyof typeof mocAddresses;
  const signer = ethers.provider.getSigner();

  const deployedMocContract = await deployments.getOrNull("MocCARC20");
  if (!deployedMocContract) throw new Error("No Moc deployed.");
  const MocCore: MocCARC20 = MocCARC20__factory.connect(deployedMocContract.address, signer);

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCARC20");
  if (!deployedTCContract) throw new Error("No CollateralToken deployed.");
  const CollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

  //TODO: for live deployments we need to receive the Collateral Asset address
  let collateralAssetToken: string = "";

  // for tests we deploy a Collateral Asset
  if (network == "hardhat") {
    const deployedERC20MockContract = await deployments.deploy("CollateralAssetCARC20", {
      contract: "ERC20Mock",
      from: deployer,
      gasLimit: GAS_LIMIT_PATCH,
    });
    collateralAssetToken = deployedERC20MockContract.address;
  }

  // initializations
  await waitForTxConfirmation(
    MocCore.initialize(
      collateralAssetToken,
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

deployFunc.id = "Initialized_CARC20"; // id required to prevent reexecution
deployFunc.tags = ["InitializerCARC20"];
deployFunc.dependencies = ["MocCARC20", "CollateralTokenCARC20", "CollateralAssetCARC20"];
