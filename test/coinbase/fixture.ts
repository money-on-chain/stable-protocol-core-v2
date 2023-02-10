import { deployments } from "hardhat";
import memoizee from "memoizee";
import {
  ERC20Mock,
  ERC20Mock__factory,
  MocCACoinbase,
  MocCACoinbase__factory,
  MocRC20,
  MocRC20__factory,
  PriceProviderMock,
} from "../../typechain";
import { deployAndAddPeggedTokens } from "../helpers/utils";

export const fixtureDeployedMocCoinbase = memoizee(
  (
    amountPegTokens: number,
    tpParams?: any,
  ): (() => Promise<{
    mocImpl: MocCACoinbase;
    mocCollateralToken: MocRC20;
    mocPeggedTokens: MocRC20[];
    priceProviders: PriceProviderMock[];
    feeToken: ERC20Mock;
  }>) => {
    return deployments.createFixture(async ({ ethers }) => {
      await deployments.fixture();
      const signer = ethers.provider.getSigner();

      const deployedMocContract = await deployments.getOrNull("MocCACoinbaseProxy");
      if (!deployedMocContract) throw new Error("No MocCACoinbase deployed.");
      const mocImpl: MocCACoinbase = MocCACoinbase__factory.connect(deployedMocContract.address, signer);

      const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbaseProxy");
      if (!deployedTCContract) throw new Error("No CollateralTokenCoinbaseProxy deployed.");
      const mocCollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

      const { mocPeggedTokens, priceProviders } = await deployAndAddPeggedTokens(mocImpl, amountPegTokens, tpParams);

      const feeToken = ERC20Mock__factory.connect(await mocImpl.feeToken(), signer);

      return {
        mocImpl,
        mocCollateralToken,
        mocPeggedTokens,
        priceProviders,
        feeToken,
      };
    });
  },
);
