import { deployments, getNamedAccounts } from "hardhat";
import memoizee from "memoizee";
import { ERC777Mock, ERC777Mock__factory, MocCARC20, MocCARC20__factory } from "../../../typechain";
import { mocInitialize } from "../../initialization/initializers";
import {
  CONSTANTS,
  deployAndAddPeggedTokens,
  deployAsset,
  deployAndInitTC,
  deployDataProvider,
  deployPriceProvider,
  ensureERC1820,
  pEth,
} from "../../helpers/utils";

export const fixtureDeployedMocRC777 = memoizee(
  (
    amountPegTokens: number,
    tpParams?: any,
  ): (() => Promise<{
    mocImpl: MocCARC20;
    collateralAsset: ERC777Mock;
  }>) => {
    return deployments.createFixture(async ({ ethers }) => {
      await deployments.fixture();
      const { deployer } = await getNamedAccounts();
      // for parallel test we need to deploy ERC1820 again because it could be deployed by hardhat-erc1820 in another Mocha worker
      await ensureERC1820();

      const [mocCoreFactory, mocExpansionFactory, mocVendorsFactory, erc1967ProxyProxyFactory] = await Promise.all([
        ethers.getContractFactory("MocCARC20"),
        ethers.getContractFactory("MocCoreExpansion"),
        ethers.getContractFactory("MocVendors"),
        ethers.getContractFactory("ERC1967Proxy"),
      ]);

      const mocCARC20 = await mocCoreFactory.deploy();
      const mocCoreExpansion = await mocExpansionFactory.deploy();
      const mocVendors = await mocVendorsFactory.deploy();
      const deployMocProxy = await erc1967ProxyProxyFactory.deploy(mocCARC20.address, "0x");
      const mocImpl = MocCARC20__factory.connect(deployMocProxy.address, ethers.provider.getSigner());

      const governorMockFactory = await ethers.getContractFactory("GovernorMock");
      const governorAddress = (await governorMockFactory.deploy()).address;

      const collateralToken = await deployAndInitTC({
        adminAddress: deployer,
        governorAddress: governorAddress,
      });

      const deployedERC777MockContract = await (await ethers.getContractFactory("ERC777Mock")).deploy([deployer]);
      const collateralAsset: ERC777Mock = ERC777Mock__factory.connect(
        deployedERC777MockContract.address,
        ethers.provider.getSigner(),
      );

      const feeTokenAddress = (await deployAsset()).address;
      const feeTokenPriceProviderAddress = (await deployPriceProvider(pEth(1))).address;
      const maxAbsoluteOpProviderAddress = (await deployDataProvider(CONSTANTS.MAX_UINT256)).address;
      const maxOpDiffProviderAddress = (await deployDataProvider(CONSTANTS.MAX_UINT256)).address;

      await mocInitialize(
        mocImpl,
        collateralAsset.address,
        collateralToken.address,
        mocCoreExpansion.address,
        mocVendors.address,
      )({
        mocGovernorAddress: governorAddress,
        feeTokenAddress,
        feeTokenPriceProviderAddress,
        maxAbsoluteOpProviderAddress,
        maxOpDiffProviderAddress,
      });

      await collateralToken.transferAllRoles(mocImpl.address);

      await deployAndAddPeggedTokens(mocImpl, amountPegTokens, tpParams);

      return {
        mocImpl,
        collateralAsset,
      };
    });
  },
);
