import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployUUPSArtifact, getGovernorAddresses, getNetworkDeployParams } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const { coreParams, settlementParams, feeParams, mocAddresses } = getNetworkDeployParams(hre);

  const deployedMocExpansionContract = await deployments.getOrNull("MocCABagExpansion");
  if (!deployedMocExpansionContract) throw new Error("No MocCABagExpansion deployed.");

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCABagProxy");
  if (!deployedTCContract) throw new Error("No CollateralTokenCABagProxy deployed.");

  const deployedWCAContract = await deployments.getOrNull("WrappedCollateralAssetProxy");
  if (!deployedWCAContract) throw new Error("No WrappedCollateralAssetProxy deployed.");

  const deployedMocVendors = await deployments.getOrNull("MocVendorsCABagProxy");
  if (!deployedMocVendors) throw new Error("No MocVendors deployed.");

  let {
    pauserAddress,
    feeTokenAddress,
    feeTokenPriceProviderAddress,
    mocFeeFlowAddress,
    mocAppreciationBeneficiaryAddress,
  } = mocAddresses;

  // for tests we deploy a FeeToken mock and its price provider
  if (hre.network.tags.local) {
    const rc20MockFactory = await ethers.getContractFactory("ERC20Mock");
    feeTokenAddress = (await rc20MockFactory.deploy()).address;

    const priceProviderMockFactory = await ethers.getContractFactory("PriceProviderMock");
    feeTokenPriceProviderAddress = (await priceProviderMockFactory.deploy(ethers.utils.parseEther("1"))).address;
  }

  const governorAddress = await getGovernorAddresses(hre);

  await deployUUPSArtifact({
    hre,
    artifactBaseName: "MocCABag",
    contract: "MocCARC20",
    initializeArgs: [
      {
        initializeCoreParams: {
          initializeBaseBucketParams: {
            feeTokenAddress,
            feeTokenPriceProviderAddress,
            tcTokenAddress: deployedTCContract.address,
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
          mocVendors: deployedMocVendors.address,
        },
        acTokenAddress: deployedWCAContract.address,
      },
    ],
  });

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocCABag"; // id required to prevent re-execution
deployFunc.tags = ["MocCABag"];
deployFunc.dependencies = ["CollateralTokenCABag", "WrappedCollateralAsset", "MocVendorsCABag", "MocCABagExpansion"];
