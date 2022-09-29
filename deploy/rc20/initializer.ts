import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  MocRC20,
  MocRC20__factory,
  MocCARC20,
  MocCARC20__factory,
  MocSettlement,
  MocSettlement__factory,
} from "../../typechain";
import { GAS_LIMIT_PATCH, waitForTxConfirmation } from "../../scripts/utils";
import { coreParams, settlementParams, tcParams, mocAddresses } from "../../deploy-config/config";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const network = hre.network.name as keyof typeof mocAddresses;
  const signer = ethers.provider.getSigner();

  const deployedMocContract = await deployments.getOrNull("MocCARC20Proxy");
  if (!deployedMocContract) throw new Error("No MocCARC20Proxy deployed.");
  const mocCARC20: MocCARC20 = MocCARC20__factory.connect(deployedMocContract.address, signer);

  const deployedMocSettlementContractProxy = await deployments.getOrNull("MocSettlementCARC20Proxy");
  if (!deployedMocSettlementContractProxy) throw new Error("No MocSettlementCARC20Proxy deployed.");
  const MocSettlement: MocSettlement = MocSettlement__factory.connect(
    deployedMocSettlementContractProxy.address,
    signer,
  );

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCARC20");
  if (!deployedTCContract) throw new Error("No CollateralTokenCARC20 deployed.");
  const CollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

  //TODO: for live deployments we need to receive the Collateral Asset address
  let collateralAssetToken: string = "";

  let { governorAddress, stopperAddress, mocFeeFlowAddress, mocInterestCollectorAddress } = mocAddresses[network];

  // for tests we deploy a Collateral Asset and Governor Mock
  if (network === "hardhat") {
    const governorMockFactory = await ethers.getContractFactory("GovernorMock");
    governorAddress = (await governorMockFactory.deploy()).address;

    const deployedERC20MockContract = await deployments.deploy("CollateralAssetCARC20", {
      contract: "ERC20Mock",
      from: deployer,
      gasLimit: GAS_LIMIT_PATCH,
    });
    collateralAssetToken = deployedERC20MockContract.address;
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
            protThrld: coreParams.protThrld,
            liqThrld: coreParams.liqThrld,
            tcMintFee: tcParams.mintFee,
            tcRedeemFee: tcParams.redeemFee,
            sf: coreParams.sf,
            fa: coreParams.fa,
          },
          governorAddress,
          stopperAddress,
          emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
        },
        acTokenAddress: collateralAssetToken,
      },
      { gasLimit: GAS_LIMIT_PATCH },
    ),
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

deployFunc.id = "Initialized_CARC20"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCARC20"];
deployFunc.dependencies = ["MocCARC20", "CollateralTokenCARC20", "CollateralAssetCARC20", "MocSettlementCARC20"];
