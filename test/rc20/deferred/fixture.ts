import hre, { deployments, getNamedAccounts } from "hardhat";
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
  DataProviderMock,
} from "../../../typechain";
import { EXECUTOR_ROLE, deployAndAddPeggedTokens, pEth } from "../../helpers/utils";
import { getNetworkDeployParams } from "../../../scripts/utils";

export const fixtureDeployedMocRC20Deferred = memoizee(
  (
    amountPegTokens: number,
    tpParams?: any,
    useMockQueue?: boolean,
  ): (() => Promise<{
    mocImpl: MocCARC20Deferred;
    mocCollateralToken: MocRC20;
    mocPeggedTokens: MocRC20[];
    priceProviders: PriceProviderMock[];
    collateralAsset: ERC20Mock;
    feeToken: ERC20Mock;
    feeTokenPriceProvider: PriceProviderMock;
    mocQueue: MocQueue;
    maxAbsoluteOpProviders: DataProviderMock[];
    maxOpDiffProviders: DataProviderMock[];
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
      let mocQueue: MocQueue;

      const { deployer, alice, bob, charlie, vendor } = await getNamedAccounts();

      if (useMockQueue) {
        const mocQueueMockFactory = await ethers.getContractFactory("MocQueueMock");
        const mocQueueMock = await mocQueueMockFactory.deploy();

        mocQueue = MocQueue__factory.connect(mocQueueMock.address, ethers.provider.getSigner());
        const { minOperWaitingBlk, execFeeParams } = getNetworkDeployParams(hre).queueParams;
        await mocQueue.initialize(await mocImpl.governor(), await mocImpl.pauser(), minOperWaitingBlk, execFeeParams);
        await Promise.all([
          mocImpl.setMocQueue(mocQueue.address),
          mocQueue.registerBucket(mocImpl.address),
          mocQueue.grantRole(EXECUTOR_ROLE, deployer),
        ]);
      } else {
        mocQueue = MocQueue__factory.connect(await mocImpl.mocQueue(), signer);
      }

      // Fill users accounts with balance so that they can operate
      await Promise.all([alice, bob, charlie].map(address => collateralAsset.mint(address, pEth(1000000000000))));

      // initialize vendor with 10% markup
      await mocVendors.connect(await ethers.getSigner(vendor)).setMarkup(pEth(0.1));

      const { mocPeggedTokens, priceProviders, maxAbsoluteOpProviders, maxOpDiffProviders } =
        await deployAndAddPeggedTokens(mocImpl, amountPegTokens, tpParams);

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
        maxAbsoluteOpProviders,
        maxOpDiffProviders,
      };
    });
  },
);
