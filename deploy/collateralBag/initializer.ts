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
  MocSettlement,
  MocSettlement__factory,
  MocTC,
  MocTC__factory,
} from "../../typechain";
import { GAS_LIMIT_PATCH, waitForTxConfirmation } from "../../scripts/utils";
import { coreParams, settlementParams, tcParams, mocAddresses } from "../../deploy-config/config";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const network = hre.network.name as keyof typeof mocAddresses;
  const signer = ethers.provider.getSigner();

  const deployedMocContract = await deployments.getOrNull("MocCABagProxy");
  if (!deployedMocContract) throw new Error("No MocCABagProxy deployed.");
  const mocCARC20: MocCARC20 = MocCARC20__factory.connect(deployedMocContract.address, signer);

  const deployedMocSettlementContractProxy = await deployments.getOrNull("MocSettlementCABagProxy");
  if (!deployedMocSettlementContractProxy) throw new Error("No MocSettlementCABagProxy deployed.");
  const MocSettlement: MocSettlement = MocSettlement__factory.connect(
    deployedMocSettlementContractProxy.address,
    signer,
  );

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCARBag");
  if (!deployedTCContract) throw new Error("No CollateralTokenCARBag deployed.");
  const CollateralToken: MocTC = MocTC__factory.connect(deployedTCContract.address, signer);

  const deployedMocCAWrapperContract = await deployments.getOrNull("MocCAWrapperProxy");
  if (!deployedMocCAWrapperContract) throw new Error("No MocCAWrapper deployed.");
  const MocCAWrapper: MocCAWrapper = MocCAWrapper__factory.connect(deployedMocCAWrapperContract.address, signer);

  const deployedWCAContract = await deployments.getOrNull("WrappedCollateralAsset");
  if (!deployedWCAContract) throw new Error("No WrappedCollateralAsset deployed.");
  const WCAToken: MocRC20 = MocRC20__factory.connect(deployedWCAContract.address, signer);

  let { governorAddress, stopperAddress, mocFeeFlowAddress, mocInterestCollectorAddress, mocTurboAddress } =
    mocAddresses[network];

  // for tests only, we deploy a necessary Mocks
  if (network == "hardhat") {
    const governorMockFactory = await ethers.getContractFactory("GovernorMock");
    governorAddress = (await governorMockFactory.deploy()).address;
  }

  // initializations
  await waitForTxConfirmation(
    mocCARC20.initialize(
      {
        initializeCoreParams: {
          initializeBaseBucketParams: {
            tcTokenAddress: CollateralToken.address,
            mocSettlementAddress: MocSettlement.address,
            mocFeeFlowAddress,
            mocInterestCollectorAddress,
            mocTurboAddress,
            protThrld: coreParams.protThrld,
            liqThrld: coreParams.liqThrld,
            tcMintFee: tcParams.mintFee,
            tcRedeemFee: tcParams.redeemFee,
            fasf: coreParams.fasf,
            sf: coreParams.sf,
          },
          governorAddress,
          stopperAddress,
          emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
        },
        acTokenAddress: WCAToken.address,
      },
      { gasLimit: GAS_LIMIT_PATCH },
    ),
  );

  await waitForTxConfirmation(
    MocCAWrapper.initialize(governorAddress, stopperAddress, mocCARC20.address, WCAToken.address, {
      gasLimit: GAS_LIMIT_PATCH,
    }),
  );

  await waitForTxConfirmation(
    MocSettlement.initialize(
      governorAddress,
      stopperAddress,
      mocCARC20.address,
      settlementParams.bes,
      settlementParams.bmulcdj,
    ),
  );

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_CARBag"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCARBag"];
deployFunc.dependencies = [
  "MocCABag",
  "CollateralTokenCARBag",
  "MocCAWrapper",
  "WrappedCollateralAsset",
  "MocSettlementCARBag",
];
