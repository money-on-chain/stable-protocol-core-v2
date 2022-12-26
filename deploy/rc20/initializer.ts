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
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const network = hre.network.name;
  const { coreParams, settlementParams, feeParams, ctParams, tpParams, mocAddresses } = getNetworkDeployParams(hre);
  const signer = ethers.provider.getSigner();

  const deployedMocContract = await deployments.getOrNull("MocCARC20Proxy");
  if (!deployedMocContract) throw new Error("No MocCARC20Proxy deployed.");
  const mocCARC20 = await ethers.getContractAt("MocCARC20", deployedMocContract.address, signer);

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCARC20Proxy");
  if (!deployedTCContract) throw new Error("No CollateralTokenCARC20Proxy deployed.");
  const CollateralToken = await ethers.getContractAt("MocTC", deployedTCContract.address, signer);

  //TODO: for live deployments we need to receive the Collateral Asset address
  let collateralAssetToken: string = "";

  let { governorAddress, pauserAddress, mocFeeFlowAddress, mocAppreciationBeneficiaryAddress } = mocAddresses;

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

  console.log("initializing...");
  // initializations
  await waitForTxConfirmation(
    CollateralToken.initialize(ctParams.name, ctParams.symbol, deployedMocContract.address, governorAddress, {
      gasLimit: GAS_LIMIT_PATCH,
    }),
  );
  await waitForTxConfirmation(
    mocCARC20.initialize(
      {
        initializeCoreParams: {
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
        acTokenAddress: collateralAssetToken,
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
            mocCARC20.address,
            mocAddresses.governorAddress,
            {
              gasLimit: GAS_LIMIT_PATCH,
            },
          ),
        );
        console.log(`Adding ${tpParams.tpParams[i].name} as PeggedToken ${i}...`);
        await waitForTxConfirmation(
          mocCARC20.addPeggedToken(
            {
              tpTokenAddress: mocRC20Proxy.address.toLowerCase(),
              priceProviderAddress: tpParams.tpParams[i].priceProvider,
              tpCtarg: tpParams.tpParams[i].ctarg,
              tpMintFee: tpParams.tpParams[i].mintFee,
              tpRedeemFee: tpParams.tpParams[i].redeemFee,
              tpEma: tpParams.tpParams[i].initialEma,
              tpEmaSf: tpParams.tpParams[i].smoothingFactor,
            },
            {
              gasLimit: GAS_LIMIT_PATCH,
            },
          ),
        );
      }
    }
    console.log("Renouncing temp governance...");
    await waitForTxConfirmation(
      mocCARC20.changeGovernor(mocAddresses.governorAddress, {
        gasLimit: GAS_LIMIT_PATCH,
      }),
    );
    console.log(`mocCARC20 governor is now: ${mocAddresses.governorAddress}`);
  }
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_CARC20"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCARC20"];
deployFunc.dependencies = ["MocCARC20", "CollateralTokenCARC20", "CollateralAssetCARC20"];
