import { deployments } from "hardhat";
import memoizee from "memoizee";
import {
  ERC20Mock,
  MocCARC20,
  MocCARC20__factory,
  MocCoreExpansion,
  MocCoreExpansion__factory,
  MocCAWrapper,
  MocCAWrapper__factory,
  MocRC20,
  MocRC20__factory,
  MocTC,
  MocTC__factory,
  PriceProviderMock,
} from "../../typechain";
import { deployAndAddAssets, deployAndAddPeggedTokens } from "../helpers/utils";

export type MoCContracts = {
  mocImpl: MocCARC20;
  mocCoreExpansion: MocCoreExpansion;
  mocWrapper: MocCAWrapper;
  mocCollateralToken: MocTC;
  mocPeggedTokens: MocRC20[];
  priceProviders: PriceProviderMock[];
  wcaToken: MocRC20;
  assets: ERC20Mock[];
  assetPriceProviders: PriceProviderMock[];
};

export const fixtureDeployedMocCABag = memoizee(
  (amountPegTokens: number, tpParams?: any, amountAssets = 1): (() => Promise<MoCContracts>) => {
    return deployments.createFixture(async ({ ethers }) => {
      await deployments.fixture();
      const signer = ethers.provider.getSigner();

      const deployedMocContract = await deployments.getOrNull("MocCABagProxy");
      if (!deployedMocContract) throw new Error("No MocCABagProxy deployed.");
      const mocImpl: MocCARC20 = MocCARC20__factory.connect(deployedMocContract.address, signer);

      const deployedMocExpansionContract = await deployments.getOrNull("MocCABagExpansion");
      if (!deployedMocExpansionContract) throw new Error("No MocCABagExpansion deployed.");
      const mocCoreExpansion: MocCoreExpansion = MocCoreExpansion__factory.connect(
        deployedMocExpansionContract.address,
        signer,
      );

      const deployedMocCAWrapperContract = await deployments.getOrNull("MocCAWrapperProxy");
      if (!deployedMocCAWrapperContract) throw new Error("No MocCAWrapper deployed.");
      const mocWrapper: MocCAWrapper = MocCAWrapper__factory.connect(deployedMocCAWrapperContract.address, signer);

      const deployedTCContract = await deployments.getOrNull("CollateralTokenCABagProxy");
      if (!deployedTCContract) throw new Error("No CollateralTokenCABagProxy deployed.");
      const mocCollateralToken: MocTC = MocTC__factory.connect(deployedTCContract.address, signer);

      const deployedWCAContract = await deployments.getOrNull("WrappedCollateralAssetProxy");
      if (!deployedWCAContract) throw new Error("No WrappedCollateralAssetProxy deployed.");
      const wcaToken: MocRC20 = MocRC20__factory.connect(deployedWCAContract.address, signer);

      const { mocPeggedTokens, priceProviders } = await deployAndAddPeggedTokens(mocImpl, amountPegTokens, tpParams);

      const { assets, assetPriceProviders } = await deployAndAddAssets(mocWrapper, amountAssets);

      return {
        mocImpl,
        mocCoreExpansion,
        mocWrapper,
        mocCollateralToken,
        mocPeggedTokens,
        priceProviders,
        wcaToken,
        assets,
        assetPriceProviders,
      };
    });
  },
);
