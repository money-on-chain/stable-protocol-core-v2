import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { addPeggedTokensAndChangeGovernor, getNetworkDeployParams, waitForTxConfirmation } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { coreParams, settlementParams, feeParams, tpParams, mocAddresses, gasLimit } = getNetworkDeployParams(hre);
  const signer = ethers.provider.getSigner();

  const deployedMocContract = await deployments.getOrNull("MocCARC20Proxy");
  if (!deployedMocContract) throw new Error("No MocCARC20Proxy deployed.");
  const mocCARC20 = await ethers.getContractAt("MocCARC20", deployedMocContract.address, signer);

  const deployedMocExpansionContract = await deployments.getOrNull("MocCARC20Expansion");
  if (!deployedMocExpansionContract) throw new Error("No MocCARC20Expansion deployed.");

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCARC20Proxy");
  if (!deployedTCContract) throw new Error("No CollateralTokenCARC20Proxy deployed.");
  const CollateralToken = await ethers.getContractAt("MocTC", deployedTCContract.address, signer);

  const deployedMocVendors = await deployments.getOrNull("MocVendorsCARC20Proxy");
  if (!deployedMocVendors) throw new Error("No MocVendors deployed.");
  const MocVendors = await ethers.getContractAt("MocVendors", deployedMocVendors.address, signer);

  let {
    collateralAssetAddress,
    governorAddress,
    pauserAddress,
    feeTokenAddress,
    feeTokenPriceProviderAddress,
    mocFeeFlowAddress,
    mocAppreciationBeneficiaryAddress,
    vendorsGuardianAddress,
  } = mocAddresses;

  // for tests and testnet we deploy a Governor Mock
  if (hre.network.tags.testnet || hre.network.tags.local) {
    const governorMockFactory = await ethers.getContractFactory("GovernorMock");
    governorAddress = (await governorMockFactory.deploy()).address;
  }

  // for tests we deploy a Collateral Asset mock, a FeeToken mock and its price provider
  if (hre.network.tags.local) {
    // use deployments.deploy to get contract in fixture using deployments.getOrNull
    const deployedERC20MockContract = await deployments.deploy("CollateralAssetCARC20", {
      contract: "ERC20Mock",
      from: deployer,
      gasLimit,
    });
    collateralAssetAddress = deployedERC20MockContract.address;

    const rc20MockFactory = await ethers.getContractFactory("ERC20Mock");
    feeTokenAddress = (await rc20MockFactory.deploy()).address;

    const priceProviderMockFactory = await ethers.getContractFactory("PriceProviderMock");
    feeTokenPriceProviderAddress = (await priceProviderMockFactory.deploy(ethers.utils.parseEther("1"))).address;
  }

  console.log("initializing...");
  await waitForTxConfirmation(
    MocVendors.initialize(vendorsGuardianAddress, governorAddress, pauserAddress, {
      gasLimit,
    }),
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
          mocVendors: MocVendors.address,
        },
        acTokenAddress: collateralAssetAddress!,
      },
      { gasLimit },
    ),
  );

  console.log("Delegating CT roles to Moc");
  // Assign TC Roles, and renounce deployer ADMIN
  await waitForTxConfirmation(CollateralToken.grantAllRoles(mocCARC20.address));

  console.log("initialization completed!");
  // for testnet we add some Pegged Token and then transfer governance to the real governor
  if (hre.network.tags.testnet) {
    await addPeggedTokensAndChangeGovernor(hre, mocAddresses.governorAddress, mocCARC20, tpParams);
  }
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_CARC20"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCARC20"];
deployFunc.dependencies = ["MocCARC20", "CollateralTokenCARC20", "CollateralAssetCARC20", "MocVendors"];
