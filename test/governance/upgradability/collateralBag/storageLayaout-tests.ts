import { ethers, getNamedAccounts, upgrades } from "hardhat";
import { Contract } from "ethers";

import { MocCAWrapper__factory } from "../../../../typechain";
import { GAS_LIMIT_PATCH } from "../../../helpers/utils";

describe("Feature: Check MocCAWrapper storage layout compatibility using openzeppelin hardhat upgrade ", () => {
  let mocProxy: Contract;
  describe("GIVEN a MocCAWrapper Proxy is deployed", () => {
    before(async () => {
      const { deployer } = await getNamedAccounts();

      const governorMockFactory = await ethers.getContractFactory("GovernorMock");
      const governorMock = await governorMockFactory.deploy();

      const mocProxyFactory = await ethers.getContractFactory("MocCAWrapper");

      mocProxy = await upgrades.deployProxy(mocProxyFactory, undefined, {
        // FIXME: this is needed because of this issue: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/455
        unsafeAllow: ["delegatecall"],
        kind: "uups",
        initializer: false,
      });

      const mocWCAFactory = await ethers.getContractFactory("MocRC20");
      const mocWCA = await mocWCAFactory.deploy("mocWCA", "WCA", mocProxy.address);

      const mocImpl = MocCAWrapper__factory.connect(mocProxy.address, ethers.provider.getSigner());
      await mocImpl.initialize(governorMock.address, deployer, deployer, mocWCA.address, { gasLimit: GAS_LIMIT_PATCH });
    });
    describe("WHEN it is upgraded to a new implementation", () => {
      it("THEN it succeeds as it is consistent with the previous storage", async () => {
        const mocCAWrapperMockFactory = await ethers.getContractFactory("MocCAWrapperMock");
        await upgrades.upgradeProxy(mocProxy.address, mocRC20MockFactory, {
          // FIXME: this is needed because of this issue: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/455
          unsafeAllow: ["delegatecall"],
        });
      });
    });
  });
});
