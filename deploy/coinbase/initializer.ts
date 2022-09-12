import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { MocCACoinbase, MocCACoinbase__factory, MocTC, MocTC__factory } from "../../typechain";
import { GAS_LIMIT_PATCH, MINTER_ROLE, BURNER_ROLE, PAUSER_ROLE, waitForTxConfirmation } from "../../scripts/utils";
import { coreParams, tcParams, mocAddresses } from "../../deploy-config/config";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const network = hre.network.name as keyof typeof mocAddresses;
  const signer = ethers.provider.getSigner();

  const deployedMocContractProxy = await deployments.getOrNull("MocCACoinbaseProxy");
  if (!deployedMocContractProxy) throw new Error("No MocCACoinbaseProxy deployed.");
  const MocCACoinbase: MocCACoinbase = MocCACoinbase__factory.connect(deployedMocContractProxy.address, signer);

  const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbase");
  if (!deployedTCContract) throw new Error("No CollateralTokenCoinbase deployed.");
  const CollateralToken: MocTC = MocTC__factory.connect(deployedTCContract.address, signer);

  let { governor, stopper, mocFeeFlowAddress } = mocAddresses[network];

  // For testing environment, we use Mock helper contracts
  if (network == "hardhat") {
    const governorMockFactory = await ethers.getContractFactory("GovernorMock");
    governor = (await governorMockFactory.deploy()).address;
  }

  // initializations
  await waitForTxConfirmation(
    MocCACoinbase.initialize(
      governor,
      stopper,
      CollateralToken.address,
      mocFeeFlowAddress,
      coreParams.ctarg,
      coreParams.protThrld,
      coreParams.liqThrld,
      tcParams.mintFee,
      tcParams.redeemFee,
      coreParams.emaCalculationBlockSpan,
      { gasLimit: GAS_LIMIT_PATCH },
    ),
  );

  // set minter and burner roles
  await Promise.all(
    [MINTER_ROLE, BURNER_ROLE, PAUSER_ROLE].map(role =>
      waitForTxConfirmation(CollateralToken.grantRole(role, MocCACoinbase.address, { gasLimit: GAS_LIMIT_PATCH })),
    ),
  );

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;

deployFunc.id = "Initialized_Coinbase"; // id required to prevent re-execution
deployFunc.tags = ["InitializerCoinbase"];
deployFunc.dependencies = ["MocCACoinbase", "CollateralTokenCoinbase"];
