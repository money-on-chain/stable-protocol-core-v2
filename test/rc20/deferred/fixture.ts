import { deployments, getNamedAccounts } from "hardhat";
import memoizee from "memoizee";
import {
  ERC20Mock,
  ERC20Mock__factory,
  MocCARC20Deferred,
  MocCARC20Deferred__factory,
  MocQueue,
  MocQueue__factory,
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
    mocQueue: MocQueue;
  }>) => {
    return deployments.createFixture(async ({ ethers }) => {
      await deployments.fixture();
      const signer = ethers.provider.getSigner();

      const deployedMocContract = await deployments.getOrNull("MocCARC20DeferredProxy");
      if (!deployedMocContract) throw new Error("No MocCARC20DeferredProxy deployed.");
      const mocImpl: MocCARC20Deferred = MocCARC20Deferred__factory.connect(deployedMocContract.address, signer);

      const mocVendors: MocVendors = MocVendors__factory.connect(await mocImpl.mocVendors(), signer);
      const mocCollateralToken: MocRC20 = MocRC20__factory.connect(await mocImpl.tcToken(), signer);
      const collateralAsset: ERC20Mock = ERC20Mock__factory.connect(await mocImpl.acToken(), signer);
      const mocQueue: MocQueue = MocQueue__factory.connect(await mocImpl.mocQueue(), signer);

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
        mocQueue,
      };
    });
  },
);
