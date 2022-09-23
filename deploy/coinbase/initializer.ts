import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  MocCACoinbase,
  MocCACoinbase__factory,
  MocTC,
  MocTC__factory,
  MocSettlement,
  MocSettlement__factory,
} from "../../typechain";
import { GAS_LIMIT_PATCH, waitForTxConfirmation } from "../../scripts/utils";
import { coreParams, settlementParams, tcParams, mocAddresses } from "../../deploy-config/config";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const network = hre.network.name as keyof typeof mocAddresses;
  const signer = ethers.provider.getSigner();

  const deployedMocContractProxy = await deployments.getOrNull("MocCACoinbaseProxy");
  if (!deployedMocContractProxy) throw new Error("No MocCACoinbaseProxy deployed.");
  const MocCACoinbase: MocCACoinbase = MocCACoinbase__factory.connect(deployedMocContractProxy.address, signer);

  const deployedMocSettlementContractProxy = await deployments.getOrNull("MocSettlementCACoinbaseProxy");
  if (!deployedMocSettlementContractProxy) throw new Error("No MocSettlementCACoinbaseProxy deployed.");
  const MocSettlement: MocSettlement = MocSettlement__factory.connect(
    deployedMocSettlementContractProxy.address,
    signer,
  );

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbase");
  if (!deployedTCContract) throw new Error("No CollateralTokenCoinbase deployed.");
  const CollateralToken: MocTC = MocTC__factory.connect(deployedTCContract.address, signer);

  let { governorAddress, stopperAddress, mocFeeFlowAddress, mocInterestCollectorAddress } = mocAddresses[network];

  // For testing environment, we use Mock helper contracts
  if (network == "hardhat") {
    const governorMockFactory = await ethers.getContractFactory("GovernorMock");
    governorAddress = (await governorMockFactory.deploy()).address;
  }

  // initializations
  await waitForTxConfirmation(
    MocCACoinbase.initialize(
      {
        governorAddress,
        stopperAddress,
        tcTokenAddress: CollateralToken.address,
        mocSettlementAddress: MocSettlement.address,
        mocFeeFlowAddress,
        mocInterestCollectorAddress,
        ctarg: coreParams.ctarg,
        protThrld: coreParams.protThrld,
        liqThrld: coreParams.liqThrld,
        tcMintFee: tcParams.mintFee,
        tcRedeemFee: tcParams.redeemFee,
        emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
      },
      { gasLimit: GAS_LIMIT_PATCH },
    ),
  );

  await waitForTxConfirmation(
    MocSettlement.initialize(
      governorAddress,
      stopperAddress,
      MocCACoinbase.address,
      settlementParams.bes,
      settlementParams.bmulcdj,
    ),
  );

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_Coinbase"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCoinbase"];
deployFunc.dependencies = ["MocCACoinbase", "CollateralTokenCoinbase", "MocSettlementCACoinbase"];
