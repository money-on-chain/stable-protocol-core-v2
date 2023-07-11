import { deployments, getNamedAccounts } from "hardhat";
import memoizee from "memoizee";
import {
  ERC20Mock,
  ERC20Mock__factory,
  MocCARC20Deferred,
  MocCARC20Deferred__factory,
  MocRC20,
  MocRC20__factory,
  MocVendors,
  MocVendors__factory,
  PriceProviderMock,
  PriceProviderMock__factory,
} from "../../../typechain";
import { deployAndAddPeggedTokens, pEth } from "../../helpers/utils";

export const fixtureDeployedMocRC20Deferred = memoizee(
  (
    amountPegTokens: number,
    tpParams?: any,
  ): (() => Promise<{
    mocImpl: MocCARC20Deferred;
    mocCollateralToken: MocRC20;
    mocPeggedTokens: MocRC20[];
    priceProviders: PriceProviderMock[];
    collateralAsset: ERC20Mock;
    feeToken: ERC20Mock;
    feeTokenPriceProvider: PriceProviderMock;
  }>) => {
    return deployments.createFixture(async ({ ethers }) => {
      await deployments.fixture();
      const signer = ethers.provider.getSigner();

      const deployedMocContract = await deployments.getOrNull("MocCARC20DeferredProxy");
      if (!deployedMocContract) throw new Error("No MocCARC20DeferredProxy deployed.");
      const mocImpl: MocCARC20Deferred = MocCARC20Deferred__factory.connect(deployedMocContract.address, signer);

      const deployedMocVendors = await deployments.getOrNull("MocVendorsCARC20Proxy");
      if (!deployedMocVendors) throw new Error("No MocVendors deployed.");
      const mocVendors: MocVendors = MocVendors__factory.connect(deployedMocVendors.address, signer);

      const deployedTCContract = await deployments.getOrNull("CollateralTokenCARC20Proxy");
      if (!deployedTCContract) throw new Error("No CollateralTokenCARC20Proxy deployed.");
      const mocCollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

      const deployedERC20MockContract = await deployments.getOrNull("CollateralAssetCARC20");
      if (!deployedERC20MockContract) throw new Error("No CollateralAssetCARC20 deployed.");
      const collateralAsset: ERC20Mock = ERC20Mock__factory.connect(deployedERC20MockContract.address, signer);

      const { alice, bob, charlie, vendor } = await getNamedAccounts();
      // Fill users accounts with balance so that they can operate
      await Promise.all([alice, bob, charlie].map(address => collateralAsset.mint(address, pEth(1000000000000))));

      // initialize vendor with 10% markup
      await mocVendors.connect(await ethers.getSigner(vendor)).setMarkup(pEth(0.1));

      const { mocPeggedTokens, priceProviders } = await deployAndAddPeggedTokens(mocImpl, amountPegTokens, tpParams);

      const feeToken = ERC20Mock__factory.connect(await mocImpl.feeToken(), signer);
      const feeTokenPriceProvider = PriceProviderMock__factory.connect(await mocImpl.feeTokenPriceProvider(), signer);

      return {
        mocImpl,
        mocCollateralToken,
        mocPeggedTokens,
        priceProviders,
        collateralAsset,
        mocVendors,
        feeToken,
        feeTokenPriceProvider,
      };
    });
  },
);
