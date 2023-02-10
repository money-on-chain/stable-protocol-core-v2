import { deployments, getNamedAccounts } from "hardhat";
import memoizee from "memoizee";
import {
  ERC20Mock,
  ERC20Mock__factory,
  MocCARC20,
  MocCARC20__factory,
  MocRC20,
  MocRC20__factory,
  PriceProviderMock,
} from "../../typechain";
import { deployAndAddPeggedTokens, pEth } from "../helpers/utils";

export const fixtureDeployedMocRC20 = memoizee(
  (
    amountPegTokens: number,
    tpParams?: any,
  ): (() => Promise<{
    mocImpl: MocCARC20;
    mocCollateralToken: MocRC20;
    mocPeggedTokens: MocRC20[];
    priceProviders: PriceProviderMock[];
    collateralAsset: ERC20Mock;
    feeToken: ERC20Mock;
  }>) => {
    return deployments.createFixture(async ({ ethers }) => {
      await deployments.fixture();
      const signer = ethers.provider.getSigner();

      const deployedMocContract = await deployments.getOrNull("MocCARC20Proxy");
      if (!deployedMocContract) throw new Error("No MocCARC20Proxy deployed.");
      const mocImpl: MocCARC20 = MocCARC20__factory.connect(deployedMocContract.address, signer);

      const deployedTCContract = await deployments.getOrNull("CollateralTokenCARC20Proxy");
      if (!deployedTCContract) throw new Error("No CollateralTokenCARC20Proxy deployed.");
      const mocCollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

      const deployedERC20MockContract = await deployments.getOrNull("CollateralAssetCARC20");
      if (!deployedERC20MockContract) throw new Error("No CollateralAssetCARC20 deployed.");
      const collateralAsset: ERC20Mock = ERC20Mock__factory.connect(deployedERC20MockContract.address, signer);

      // Fill users accounts with balance so that they can operate
      const { alice, bob, charlie } = await getNamedAccounts();
      await Promise.all([alice, bob, charlie].map(address => collateralAsset.mint(address, pEth(10000000))));

      const { mocPeggedTokens, priceProviders } = await deployAndAddPeggedTokens(mocImpl, amountPegTokens, tpParams);

      const feeToken = ERC20Mock__factory.connect(await mocImpl.feeToken(), signer);

      return {
        mocImpl,
        mocCollateralToken,
        mocPeggedTokens,
        priceProviders,
        collateralAsset,
        feeToken,
      };
    });
  },
);
