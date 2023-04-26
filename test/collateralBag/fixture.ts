import { deployments, getNamedAccounts } from "hardhat";
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
  ERC20Mock__factory,
  MocVendors,
  MocVendors__factory,
  PriceProviderMock__factory,
} from "../../typechain";
import { deployAndAddAssets, deployAndAddPeggedTokens, ensureERC1820, pEth } from "../helpers/utils";

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
  mocVendors: MocVendors;
  feeToken: ERC20Mock;
  feeTokenPriceProvider: PriceProviderMock;
};

export const fixtureDeployedMocCABag = memoizee(
  (amountPegTokens: number, tpParams?: any, amountAssets = 1): (() => Promise<MoCContracts>) => {
    return deployments.createFixture(async ({ ethers }) => {
      await deployments.fixture();
      const signer = ethers.provider.getSigner();
      // for parallel test we need to deploy ERC1820 again because it could be deployed by hardhat-erc1820 in another Mocha worker
      await ensureERC1820();

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

      const deployedMocVendors = await deployments.getOrNull("MocVendorsCABagProxy");
      if (!deployedMocVendors) throw new Error("No MocVendors deployed.");
      const mocVendors: MocVendors = MocVendors__factory.connect(deployedMocVendors.address, signer);

      const { mocPeggedTokens, priceProviders } = await deployAndAddPeggedTokens(mocImpl, amountPegTokens, tpParams);

      const { assets, assetPriceProviders } = await deployAndAddAssets(mocWrapper, amountAssets);

      // initialize vendor with 10% markup
      const { vendor } = await getNamedAccounts();
      await mocVendors.connect(await ethers.getSigner(vendor)).setMarkup(pEth(0.1));

      const feeToken = ERC20Mock__factory.connect(await mocImpl.feeToken(), signer);
      const feeTokenPriceProvider = PriceProviderMock__factory.connect(await mocImpl.feeTokenPriceProvider(), signer);

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
        mocVendors,
        feeToken,
        feeTokenPriceProvider,
      };
    });
  },
);
