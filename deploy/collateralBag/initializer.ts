import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { GAS_LIMIT_PATCH, getNetworkDeployParams, waitForTxConfirmation } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const network = hre.network.name;
  const { coreParams, settlementParams, feeParams, ctParams, mocAddresses } = getNetworkDeployParams(hre);
  const signer = ethers.provider.getSigner();

  const deployedMocContract = await deployments.getOrNull("MocCABagProxy");
  if (!deployedMocContract) throw new Error("No MocCABagProxy deployed.");
  const mocCARC20 = await ethers.getContractAt("MocCARC20", deployedMocContract.address, signer);

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCABagProxy");
  if (!deployedTCContract) throw new Error("No CollateralTokenCABagProxy deployed.");
  const CollateralToken = await ethers.getContractAt("MocTC", deployedTCContract.address, signer);

  const deployedMocCAWrapperContract = await deployments.getOrNull("MocCAWrapperProxy");
  if (!deployedMocCAWrapperContract) throw new Error("No MocCAWrapper deployed.");
  const MocCAWrapper = await ethers.getContractAt("MocCAWrapper", deployedMocCAWrapperContract.address, signer);

  const deployedWCAContract = await deployments.getOrNull("WrappedCollateralAssetProxy");
  if (!deployedWCAContract) throw new Error("No WrappedCollateralAssetProxy deployed.");
  const WCAToken = await ethers.getContractAt("MocRC20", deployedWCAContract.address, signer);

  let { governorAddress, pauserAddress, mocFeeFlowAddress, mocAppreciationBeneficiaryAddress } = mocAddresses;

  // for tests only, we deploy a necessary Mocks
  if (network == "hardhat") {
    const governorMockFactory = await ethers.getContractFactory("GovernorMock");
    governorAddress = (await governorMockFactory.deploy()).address;
  }

  console.log("initializing...");
  // initializations
  await waitForTxConfirmation(
    CollateralToken.initialize(ctParams.name, ctParams.symbol, deployedMocContract.address, governorAddress, {
      gasLimit: GAS_LIMIT_PATCH,
    }),
  );
  await waitForTxConfirmation(
    WCAToken.initialize("WrappedCollateralAsset", "WCA", deployedMocCAWrapperContract.address, governorAddress, {
      gasLimit: GAS_LIMIT_PATCH,
    }),
  );

  await waitForTxConfirmation(
    mocCARC20.initialize(
      {
        initializeCoreParams: {
          initializeBaseBucketParams: {
            tcTokenAddress: CollateralToken.address,
            mocFeeFlowAddress,
            mocAppreciationBeneficiaryAddress,
            protThrld: coreParams.protThrld,
            liqThrld: coreParams.liqThrld,
            feeRetainer: feeParams.feeRetainer,
            tcMintFee: feeParams.mintFee,
            tcRedeemFee: feeParams.redeemFee,
            swapTPforTPFee: feeParams.swapTPforTPFee,
            swapTPforTCFee: feeParams.swapTPforTCFee,
            swapTCforTPFee: feeParams.swapTCforTPFee,
            redeemTCandTPFee: feeParams.redeemTCandTPFee,
            mintTCandTPFee: feeParams.mintTCandTPFee,
            successFee: coreParams.successFee,
            appreciationFactor: coreParams.appreciationFactor,
          },
          governorAddress,
          pauserAddress,
          emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
          bes: settlementParams.bes,
        },
        acTokenAddress: WCAToken.address,
      },
      { gasLimit: GAS_LIMIT_PATCH },
    ),
  );
  await waitForTxConfirmation(
    MocCAWrapper.initialize(governorAddress, pauserAddress, mocCARC20.address, WCAToken.address, {
      gasLimit: GAS_LIMIT_PATCH,
    }),
  );
  console.log("initialization completed!");
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_CABag"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCABag"];
deployFunc.dependencies = ["MocCABag", "CollateralTokenCABag", "MocCAWrapper", "WrappedCollateralAsset"];
