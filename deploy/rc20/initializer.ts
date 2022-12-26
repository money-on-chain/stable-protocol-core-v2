import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  deployAndAddPeggedToken,
  GAS_LIMIT_PATCH,
  getNetworkDeployParams,
  waitForTxConfirmation,
} from "../../scripts/utils";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
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
  if (hre.network.tags.testnet || hre.network.tags.local) {
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
    CollateralToken.initialize(
      ctParams.name,
      ctParams.symbol,
      deployedMocContract.address,
      mocAddresses.governorAddress,
      {
        gasLimit: GAS_LIMIT_PATCH,
      },
    ),
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
    await deployAndAddPeggedToken(hre, mocAddresses.governorAddress, mocCARC20, tpParams);
  }
  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_CARC20"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCARC20"];
deployFunc.dependencies = ["MocCARC20", "CollateralTokenCARC20", "CollateralAssetCARC20"];
