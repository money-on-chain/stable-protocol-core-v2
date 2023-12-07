import hre, { deployments, getNamedAccounts } from "hardhat";
import memoizee from "memoizee";
import { deployMocQueue } from "../../scripts/utils";
import {
  ERC20Mock,
  ERC20Mock__factory,
  MocCACoinbase,
  MocCACoinbase__factory,
  MocRC20,
  MocRC20__factory,
  MocVendors,
  MocVendors__factory,
  PriceProviderMock,
  PriceProviderMock__factory,
  DataProviderMock,
  DataProviderMock__factory,
  MocQueue,
  MocQueue__factory,
} from "../../typechain";
import { deployAndAddPeggedTokens, EXECUTOR_ROLE, pEth } from "../helpers/utils";

export const fixtureDeployedMocCoinbase = memoizee(
  (
    amountPegTokens: number,
    tpParams?: any,
    useMockQueue?: boolean,
  ): (() => Promise<{
    mocImpl: MocCACoinbase;
    mocCollateralToken: MocRC20;
    mocPeggedTokens: MocRC20[];
    priceProviders: PriceProviderMock[];
    feeToken: ERC20Mock;
    feeTokenPriceProvider: PriceProviderMock;
    mocQueue: MocQueue;
    maxAbsoluteOpProvider: DataProviderMock;
    maxOpDiffProvider: DataProviderMock;
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
      const feeTokenPriceProvider = PriceProviderMock__factory.connect(await mocImpl.feeTokenPriceProvider(), signer);

      const maxAbsoluteOpProvider = DataProviderMock__factory.connect(await mocImpl.maxAbsoluteOpProvider(), signer);
      const maxOpDiffProvider = DataProviderMock__factory.connect(await mocImpl.maxOpDiffProvider(), signer);

      const deployedMocVendors = await deployments.getOrNull("MocVendorsCACoinbaseProxy");
      if (!deployedMocVendors) throw new Error("No MocVendors deployed.");
      const mocVendors: MocVendors = MocVendors__factory.connect(deployedMocVendors.address, signer);

      // initialize vendor with 10% markup
      const { deployer, vendor } = await getNamedAccounts();

      let mocQueue: MocQueue;
      if (useMockQueue) {
        mocQueue = await deployMocQueue(hre, "MocQueueMock");
        await Promise.all([
          mocImpl.setMocQueue(mocQueue.address),
          mocQueue.registerBucket(mocImpl.address),
          mocQueue.grantRole(EXECUTOR_ROLE, deployer),
        ]);
      } else {
        mocQueue = MocQueue__factory.connect(await mocImpl.mocQueue(), signer);
      }

      await mocVendors.connect(await ethers.getSigner(vendor)).setMarkup(pEth(0.1));

      return {
        mocImpl,
        mocCollateralToken,
        mocPeggedTokens,
        priceProviders,
        feeToken,
        feeTokenPriceProvider,
        mocQueue,
        maxAbsoluteOpProvider,
        maxOpDiffProvider,
      };
    });
  },
);
