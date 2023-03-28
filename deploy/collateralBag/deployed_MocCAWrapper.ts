import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  addAssetsAndChangeGovernor,
  addPeggedTokensAndChangeGovernor,
  deployUUPSArtifact,
  getGovernorAddresses,
  getNetworkDeployParams,
  waitForTxConfirmation,
} from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const { tpParams, assetParams, mocAddresses } = getNetworkDeployParams(hre);
  const signer = ethers.provider.getSigner();

  const deployedMocContract = await deployments.getOrNull("MocCABagProxy");
  if (!deployedMocContract) throw new Error("No MocCABagProxy deployed.");
  const mocCARC20 = await ethers.getContractAt("MocCARC20", deployedMocContract.address, signer);

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCABagProxy");
  if (!deployedTCContract) throw new Error("No CollateralTokenCABagProxy deployed.");
  const CollateralToken = await ethers.getContractAt("MocTC", deployedTCContract.address, signer);

  const deployedWCAContract = await deployments.getOrNull("WrappedCollateralAssetProxy");
  if (!deployedWCAContract) throw new Error("No WrappedCollateralAssetProxy deployed.");
  const WCAToken = await ethers.getContractAt("MocRC20", deployedWCAContract.address, signer);

  let { pauserAddress } = mocAddresses;

  const governorAddress = await getGovernorAddresses(hre);

  const deployedMocCAWrapper = await deployUUPSArtifact({
    hre,
    contract: "MocCAWrapper",
    initializeArgs: [governorAddress, pauserAddress, mocCARC20.address, WCAToken.address],
  });

  console.log("delegating Roles...");
  // initializations

  await waitForTxConfirmation(WCAToken.transferAllRoles(deployedMocCAWrapper.address));
  await waitForTxConfirmation(CollateralToken.transferAllRoles(mocCARC20.address));

  // for testnet we add some Pegged Token and Assets and then transfer governance to the real governor
  if (hre.network.tags.testnet) {
    await addPeggedTokensAndChangeGovernor(hre, governorAddress, mocCARC20, tpParams);
    await addAssetsAndChangeGovernor(hre, governorAddress, deployedMocCAWrapper.address, assetParams);
  }
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocCAWrapper"; // id required to prevent re-execution
deployFunc.tags = ["MocCAWrapper"];
deployFunc.dependencies = ["MocCABag", "WrappedCollateralAsset"];
