import { deployments } from "hardhat";
import {
  MocCACoinbase,
  MocCACoinbase__factory,
  MocRC20,
  MocRC20__factory,
  MocSettlement,
  MocSettlement__factory,
  PriceProviderMock,
} from "../../typechain";
import { deployAndAddPeggedTokens } from "../helpers/utils";

export function fixtureDeployedMocCoinbase(
  amountPegTokens: number,
  tpParams?: any,
): () => Promise<{
  mocImpl: MocCACoinbase;
  mocSettlement: MocSettlement;
  mocCollateralToken: MocRC20;
  mocPeggedTokens: MocRC20[];
  priceProviders: PriceProviderMock[];
}> {
  return deployments.createFixture(async ({ ethers }) => {
    await deployments.fixture();
    const signer = ethers.provider.getSigner();

    const deployedMocContract = await deployments.getOrNull("MocCACoinbaseProxy");
    if (!deployedMocContract) throw new Error("No MocCACoinbase deployed.");
    const mocImpl: MocCACoinbase = MocCACoinbase__factory.connect(deployedMocContract.address, signer);

    const deployedMocSettlementContractProxy = await deployments.getOrNull("MocSettlementCACoinbaseProxy");
    if (!deployedMocSettlementContractProxy) throw new Error("No MocSettlementCACoinbaseProxy deployed.");
    const mocSettlement: MocSettlement = MocSettlement__factory.connect(
      deployedMocSettlementContractProxy.address,
      signer,
    );

    const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbaseProxy");
    if (!deployedTCContract) throw new Error("No CollateralTokenCoinbaseProxy deployed.");
    const mocCollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

    const { mocPeggedTokens, priceProviders } = await deployAndAddPeggedTokens(mocImpl, amountPegTokens, tpParams);

    return {
      mocImpl,
      mocSettlement,
      mocCollateralToken,
      mocPeggedTokens,
      priceProviders,
    };
  });
}
