import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  CONSTANTS,
  addPeggedTokensAndChangeGovernor,
  deployUUPSArtifact,
  getGovernorAddresses,
  getNetworkDeployParams,
  waitForTxConfirmation,
} from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const { coreParams, settlementParams, feeParams, tpParams, mocAddresses } = getNetworkDeployParams(hre);
  const signer = ethers.provider.getSigner();

  const deployedMocExpansionContract = await deployments.getOrNull("MocCACoinbaseExpansion");
  if (!deployedMocExpansionContract) throw new Error("No MocCACoinbaseExpansion deployed.");

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbaseProxy");
  if (!deployedTCContract) throw new Error("No CollateralTokenCoinbaseProxy deployed.");
  const CollateralToken = await ethers.getContractAt("MocTC", deployedTCContract.address, signer);

  const deployedMocVendors = await deployments.getOrNull("MocVendorsCACoinbaseProxy");
  if (!deployedMocVendors) throw new Error("No MocVendors deployed.");

  const deployedMocQueue = await deployments.getOrNull("MocQueueCoinbaseProxy");
  if (!deployedMocQueue) throw new Error("No MocQueue deployed.");
  const mocQueue = await ethers.getContractAt("MocQueue", deployedMocQueue.address, signer);

  let {
    pauserAddress,
    feeTokenAddress,
    feeTokenPriceProviderAddress,
    mocFeeFlowAddress,
    mocAppreciationBeneficiaryAddress,
    tcInterestCollectorAddress,
    maxAbsoluteOpProviderAddress,
    maxOpDiffProviderAddress,
    coinbaseFailedTransferFallback,
  } = mocAddresses;

  const governorAddress = await getGovernorAddresses(hre);
  // for tests we deploy a FeeToken mock and its price provider
  if (hre.network.tags.local) {
    const rc20MockFactory = await ethers.getContractFactory("ERC20Mock");
    feeTokenAddress = (await rc20MockFactory.deploy()).address;

    const priceProviderMockFactory = await ethers.getContractFactory("PriceProviderMock");
    feeTokenPriceProviderAddress = (await priceProviderMockFactory.deploy(ethers.utils.parseEther("1"))).address;

    const DataProviderMockFactory = await ethers.getContractFactory("DataProviderMock");
    maxAbsoluteOpProviderAddress = (await DataProviderMockFactory.deploy(CONSTANTS.MAX_UINT256)).address;
    maxOpDiffProviderAddress = (await DataProviderMockFactory.deploy(CONSTANTS.MAX_UINT256)).address;
  }

  const mocCACoinbase = await deployUUPSArtifact({
    hre,
    contract: "MocCACoinbase",
    initializeArgs: [
      {
        initializeDeferredParams: {
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
              tcInterestCollectorAddress,
              tcInterestRate: coreParams.tcInterestRate,
              tcInterestPaymentBlockSpan: coreParams.tcInterestPaymentBlockSpan,
              maxAbsoluteOpProviderAddress,
              maxOpDiffProviderAddress,
              decayBlockSpan: coreParams.decayBlockSpan,
            },
            governorAddress,
            pauserAddress,
            mocCoreExpansion: deployedMocExpansionContract.address,
            emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
            mocVendors: deployedMocVendors.address,
          },
          mocQueueAddress: deployedMocQueue.address,
        },
        transferMaxGas: coreParams.transferMaxGas,
        coinbaseFailedTransferFallback,
      },
    ],
  });

  // TODO: Deployer has admin privileges as this stage
  console.log(`Registering mocRC20 bucket as enqueuer: ${mocCACoinbase.address}`);
  await waitForTxConfirmation(mocQueue.registerBucket(mocCACoinbase.address));

  console.log("Delegating CT roles to Moc");
  // Assign TC Roles, and renounce deployer ADMIN
  await waitForTxConfirmation(CollateralToken.transferAllRoles(mocCACoinbase.address));

  // for testnet we add some Pegged Token and then transfer governance to the real governor
  if (hre.network.tags.testnet) {
    const mocCore = await ethers.getContractAt("MocCACoinbase", mocCACoinbase.address, signer);
    await addPeggedTokensAndChangeGovernor(hre, mocAddresses.governorAddress, mocCore, tpParams);
  }
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "deployed_MocCACoinbase"; // id required to prevent re-execution
deployFunc.tags = ["MocCACoinbase"];
deployFunc.dependencies = [
  "CollateralTokenCoinbase",
  "MocVendorsCACoinbase",
  "MocCACoinbaseExpansion",
  "MocQueueCoinbase",
];
