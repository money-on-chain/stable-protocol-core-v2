import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  addAssetsAndChangeGovernor,
  addPeggedTokensAndChangeGovernor,
  getNetworkDeployParams,
  waitForTxConfirmation,
} from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const { coreParams, settlementParams, feeParams, ctParams, tpParams, assetParams, mocAddresses, gasLimit } =
    getNetworkDeployParams(hre);
  const signer = ethers.provider.getSigner();

  const deployedMocContract = await deployments.getOrNull("MocCABagProxy");
  if (!deployedMocContract) throw new Error("No MocCABagProxy deployed.");
  const mocCARC20 = await ethers.getContractAt("MocCARC20", deployedMocContract.address, signer);

  const deployedMocExpansionContract = await deployments.getOrNull("MocCABagExpansion");
  if (!deployedMocExpansionContract) throw new Error("No MocCABagExpansion deployed.");

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCABagProxy");
  if (!deployedTCContract) throw new Error("No CollateralTokenCABagProxy deployed.");
  const CollateralToken = await ethers.getContractAt("MocTC", deployedTCContract.address, signer);

  const deployedMocCAWrapperContract = await deployments.getOrNull("MocCAWrapperProxy");
  if (!deployedMocCAWrapperContract) throw new Error("No MocCAWrapper deployed.");
  const MocCAWrapper = await ethers.getContractAt("MocCAWrapper", deployedMocCAWrapperContract.address, signer);

  const deployedWCAContract = await deployments.getOrNull("WrappedCollateralAssetProxy");
  if (!deployedWCAContract) throw new Error("No WrappedCollateralAssetProxy deployed.");
  const WCAToken = await ethers.getContractAt("MocRC20", deployedWCAContract.address, signer);

  let {
    governorAddress,
    pauserAddress,
    feeTokenAddress,
    feeTokenPriceProviderAddress,
    mocFeeFlowAddress,
    mocAppreciationBeneficiaryAddress,
  } = mocAddresses;

  // for tests only, we deploy necessary Mocks
  if (hre.network.tags.testnet || hre.network.tags.local) {
    const governorMockFactory = await ethers.getContractFactory("GovernorMock");
    governorAddress = (await governorMockFactory.deploy()).address;
  }
  // for tests we deploy a FeeToken mock and its price provider
  if (hre.network.tags.local) {
    const rc20MockFactory = await ethers.getContractFactory("ERC20Mock");
    feeTokenAddress = (await rc20MockFactory.deploy()).address;

    const priceProviderMockFactory = await ethers.getContractFactory("PriceProviderMock");
    feeTokenPriceProviderAddress = (await priceProviderMockFactory.deploy(ethers.utils.parseEther("1"))).address;
  }

  console.log("initializing...");
  // initializations
  await waitForTxConfirmation(
    CollateralToken.initialize(
      ctParams.name,
      ctParams.symbol,
      deployedMocContract.address,
      mocAddresses.governorAddress,
      {
        gasLimit,
      },
    ),
  );
  await waitForTxConfirmation(
    WCAToken.initialize(
      "WrappedCollateralAsset",
      "WCA",
      deployedMocCAWrapperContract.address,
      mocAddresses.governorAddress,
      {
        gasLimit,
      },
    ),
  );

  await waitForTxConfirmation(
    mocCARC20.initialize(
      {
        initializeCoreParams: {
          initializeBaseBucketParams: {
            feeTokenAddress,
            feeTokenPriceProviderAddress,
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
            feeTokenPct: feeParams.feeTokenPct,
            successFee: coreParams.successFee,
            appreciationFactor: coreParams.appreciationFactor,
            bes: settlementParams.bes,
          },
          governorAddress,
          pauserAddress,
          mocCoreExpansion: deployedMocExpansionContract.address,
          emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
        },
        acTokenAddress: WCAToken.address,
      },
      { gasLimit },
    ),
  );
  await waitForTxConfirmation(
    MocCAWrapper.initialize(governorAddress, pauserAddress, mocCARC20.address, WCAToken.address, {
      gasLimit,
    }),
  );
  console.log("initialization completed!");
  // for testnet we add some Pegged Token and Assets and then transfer governance to the real governor
  if (hre.network.tags.testnet) {
    await addPeggedTokensAndChangeGovernor(hre, mocAddresses.governorAddress, mocCARC20, tpParams);
    await addAssetsAndChangeGovernor(hre, mocAddresses.governorAddress, MocCAWrapper, assetParams);
  }
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_CABag"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCABag"];
deployFunc.dependencies = ["MocCABag", "CollateralTokenCABag", "MocCAWrapper", "WrappedCollateralAsset"];
