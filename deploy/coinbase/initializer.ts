import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { addPeggedTokensAndChangeGovernor, getNetworkDeployParams, waitForTxConfirmation } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const { coreParams, settlementParams, feeParams, tpParams, mocAddresses, gasLimit } = getNetworkDeployParams(hre);
  const signer = ethers.provider.getSigner();

  const deployedMocContractProxy = await deployments.getOrNull("MocCACoinbaseProxy");
  if (!deployedMocContractProxy) throw new Error("No MocCACoinbaseProxy deployed.");
  const MocCACoinbase = await ethers.getContractAt("MocCACoinbase", deployedMocContractProxy.address, signer);

  const deployedMocExpansionContract = await deployments.getOrNull("MocCACoinbaseExpansion");
  if (!deployedMocExpansionContract) throw new Error("No MocCACoinbaseExpansion deployed.");

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbaseProxy");
  if (!deployedTCContract) throw new Error("No CollateralTokenCoinbaseProxy deployed.");
  const CollateralToken = await ethers.getContractAt("MocTC", deployedTCContract.address, signer);

  const deployedMocVendors = await deployments.getOrNull("MocVendorsCACoinbaseProxy");
  if (!deployedMocVendors) throw new Error("No MocVendors deployed.");
  const MocVendors = await ethers.getContractAt("MocVendors", deployedMocVendors.address, signer);

  let {
    governorAddress,
    pauserAddress,
    feeTokenAddress,
    feeTokenPriceProviderAddress,
    mocFeeFlowAddress,
    mocAppreciationBeneficiaryAddress,
    vendorsGuardianAddress,
  } = mocAddresses;

  // For testing environment, we use Mock helper contracts
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
    MocVendors.initialize(vendorsGuardianAddress, governorAddress, pauserAddress, {
      gasLimit,
    }),
  );
  await waitForTxConfirmation(
    MocCACoinbase.initialize(
      {
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
      { gasLimit },
    ),
  );

  console.log("Delegating CT roles to Moc");
  // Assign TC Roles, and renounce deployer ADMIN
  await waitForTxConfirmation(CollateralToken.grantAllRoles(MocCACoinbase.address));

  console.log("initialization completed!");
  // for testnet we add some Pegged Token and then transfer governance to the real governor
  if (hre.network.tags.testnet) {
    await addPeggedTokensAndChangeGovernor(hre, mocAddresses.governorAddress, MocCACoinbase, tpParams);
  }
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_Coinbase"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCoinbase"];
deployFunc.dependencies = ["MocCACoinbase", "CollateralTokenCoinbase", "MocVendors"];
