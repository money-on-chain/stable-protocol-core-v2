import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { MocCACoinbase, MocCACoinbase__factory, MocTC, MocTC__factory } from "../../typechain";
import { GAS_LIMIT_PATCH, getNetworkConfig, waitForTxConfirmation } from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const network = hre.network.name;
  const { coreParams, settlementParams, feeParams, mocAddresses } = getNetworkConfig({ network });
  const signer = ethers.provider.getSigner();

  const deployedMocContractProxy = await deployments.getOrNull("MocCACoinbaseProxy");
  if (!deployedMocContractProxy) throw new Error("No MocCACoinbaseProxy deployed.");
  const MocCACoinbase: MocCACoinbase = MocCACoinbase__factory.connect(deployedMocContractProxy.address, signer);

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbaseProxy");
  if (!deployedTCContract) throw new Error("No CollateralTokenCoinbaseProxy deployed.");
  const CollateralToken: MocTC = MocTC__factory.connect(deployedTCContract.address, signer);

  let { governorAddress, pauserAddress, mocFeeFlowAddress, mocAppreciationBeneficiaryAddress } = mocAddresses;

  // For testing environment, we use Mock helper contracts
  if (network == "hardhat") {
    const governorMockFactory = await ethers.getContractFactory("GovernorMock");
    governorAddress = (await governorMockFactory.deploy()).address;
  }

  // initializations
  await waitForTxConfirmation(
    CollateralToken.initialize("CollateralToken", "CollateralToken", MocCACoinbase.address, governorAddress),
  );

  await waitForTxConfirmation(
    MocCACoinbase.initialize(
      {
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
      { gasLimit: GAS_LIMIT_PATCH },
    ),
  );

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_Coinbase"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCoinbase"];
deployFunc.dependencies = ["MocCACoinbase", "CollateralTokenCoinbase"];
