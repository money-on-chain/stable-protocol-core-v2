import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  deployUUPSArtifact,
  GAS_LIMIT_PATCH,
  getNetworkDeployParams,
  waitForTxConfirmation,
} from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const { coreParams, settlementParams, feeParams, ctParams, tpParams, mocAddresses } = getNetworkDeployParams(hre);
  const signer = ethers.provider.getSigner();

  const deployedMocContractProxy = await deployments.getOrNull("MocCACoinbaseProxy");
  if (!deployedMocContractProxy) throw new Error("No MocCACoinbaseProxy deployed.");
  const MocCACoinbase = await ethers.getContractAt("MocCACoinbase", deployedMocContractProxy.address, signer);

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbaseProxy");
  if (!deployedTCContract) throw new Error("No CollateralTokenCoinbaseProxy deployed.");
  const CollateralToken = await ethers.getContractAt("MocTC", deployedTCContract.address, signer);

  let { governorAddress, pauserAddress, mocFeeFlowAddress, mocAppreciationBeneficiaryAddress } = mocAddresses;

  // For testing environment, we use Mock helper contracts
  if (!hre.network.tags.mainnet) {
    const governorMockFactory = await ethers.getContractFactory("GovernorMock");
    governorAddress = (await governorMockFactory.deploy()).address;
  }

  console.log("initializing...");
  // initializations
  await waitForTxConfirmation(
    CollateralToken.initialize(ctParams.name, ctParams.symbol, MocCACoinbase.address, governorAddress, {
      gasLimit: GAS_LIMIT_PATCH,
    }),
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
  console.log("initialization completed!");
  // for testnet we add some Pegged Token and then transfer governance to the real governor
  if (hre.network.tags.testnet) {
    if (tpParams) {
      for (let i = 0; i < tpParams.tpParams.length; i++) {
        await deployUUPSArtifact({ hre, artifactBaseName: tpParams.tpParams[i].name, contract: "MocRC20" });
        const mocRC20TP = await deployments.getOrNull(tpParams.tpParams[i].name + "Proxy");
        if (!mocRC20TP) throw new Error(`No ${tpParams.tpParams[i].name} deployed`);

        const mocRC20Proxy = await ethers.getContractAt("MocRC20", mocRC20TP.address, signer);
        console.log(`Initializing ${tpParams.tpParams[i].name} PeggedToken...`);
        await waitForTxConfirmation(
          mocRC20Proxy.initialize(
            tpParams.tpParams[i].name,
            tpParams.tpParams[i].symbol,
            MocCACoinbase.address,
            governorAddress,
          ),
        );
        console.log(`Adding ${tpParams.tpParams[i].name} as PeggedToken ${i}...`);
        await waitForTxConfirmation(
          MocCACoinbase.addPeggedToken({
            tpTokenAddress: mocRC20Proxy.address.toLowerCase(),
            priceProviderAddress: tpParams.tpParams[i].priceProvider,
            tpCtarg: tpParams.tpParams[i].ctarg,
            tpMintFee: tpParams.tpParams[i].mintFee,
            tpRedeemFee: tpParams.tpParams[i].redeemFee,
            tpEma: tpParams.tpParams[i].initialEma,
            tpEmaSf: tpParams.tpParams[i].smoothingFactor,
          }),
        );
      }
    }
    console.log("Renouncing temp governance...");
    await waitForTxConfirmation(MocCACoinbase.changeGovernor(governorAddress));
    console.log(`mocCACoinbase governor is now: ${governorAddress}`);
  }
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_Coinbase"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCoinbase"];
deployFunc.dependencies = ["MocCACoinbase", "CollateralTokenCoinbase"];
