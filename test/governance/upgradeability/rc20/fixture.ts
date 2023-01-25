import { deployments, getNamedAccounts } from "hardhat";
import { Contract } from "ethers";
import memoizee from "memoizee";

import { MocCARC20, MocCARC20__factory } from "../../../../typechain";
import { deployAeropagusGovernor, deployCollateralToken } from "../../../helpers/utils";
import { mocInitialize } from "../../../collateralBag/initializers";

export const fixtureDeployGovernance = memoizee(
  (): (() => Promise<{
    governor: Contract;
    mocCARC20: MocCARC20;
  }>) => {
    return deployments.createFixture(async ({ ethers }) => {
      await deployments.fixture();
      const { deployer } = await getNamedAccounts();

      // deploy and initialize governor
      const [mocFactory, erc1967ProxyProxyFactory] = await Promise.all([
        ethers.getContractFactory("MocCARC20"),
        ethers.getContractFactory("ERC1967Proxy"),
      ]);

      const mocImpl = await mocFactory.deploy();
      const deployMocProxy = await erc1967ProxyProxyFactory.deploy(mocImpl.address, "0x");
      const mocCARC20 = MocCARC20__factory.connect(deployMocProxy.address, ethers.provider.getSigner());

      const governor = await deployAeropagusGovernor(deployer);

      const mocTC = await deployCollateralToken({
        adminAddress: deployMocProxy.address,
        governorAddress: governor.address,
      });

      const mockWCATokenAddress = deployer;
      await mocInitialize(
        mocCARC20,
        mockWCATokenAddress,
        mocTC.address,
        mocTC.address, // TODO: use the real one
      )({ mocGovernorAddress: governor.address });

      return {
        governor,
        mocCARC20,
      };
    });
  },
);
