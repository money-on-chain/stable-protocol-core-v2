import { deployments, getNamedAccounts } from "hardhat";
import memoizee from "memoizee";
import { ERC777Mock, ERC777Mock__factory, MocCARC20, MocCARC20__factory } from "../../../typechain";
import { mocInitialize } from "../../collateralBag/initializers";
import {
  deployAndAddPeggedTokens,
  deployAsset,
  deployCollateralToken,
  deployPriceProvider,
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

      const collateralToken = await deployCollateralToken({
        adminAddress: deployMocProxy.address,
        governorAddress: governorAddress,
      });

      const deployedERC777MockContract = await (await ethers.getContractFactory("ERC777Mock")).deploy([deployer]);
      const collateralAsset: ERC777Mock = ERC777Mock__factory.connect(
        deployedERC777MockContract.address,
        ethers.provider.getSigner(),
      );

      const feeTokenAddress = (await deployAsset()).address;
      const feeTokenPriceProviderAddress = (await deployPriceProvider(pEth(1))).address;

      await mocInitialize(
        mocImpl,
        collateralAsset.address,
        collateralToken.address,
        mocCoreExpansion.address,
        mocVendors.address,
      )({ mocGovernorAddress: governorAddress, feeTokenAddress, feeTokenPriceProviderAddress });

      await deployAndAddPeggedTokens(mocImpl, amountPegTokens, tpParams);

      return {
        mocImpl,
        collateralAsset,
      };
    });
  },
);
