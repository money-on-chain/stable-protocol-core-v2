import { ethers, getNamedAccounts, upgrades } from "hardhat";
import { Contract } from "ethers";

import { coreParams, tcParams } from "../../../../deploy-config/config";

describe("Feature: Check MocCoinbase storage layout compatibility using openzeppelin hardhat upgrade ", () => {
  let mocProxy: Contract;
  describe("GIVEN an Moc Proxy is deployed", () => {
    before(async () => {
      const { deployer } = await getNamedAccounts();

      const governorMockFactory = await ethers.getContractFactory("GovernorMock");
      const governorMock = await governorMockFactory.deploy();

      const mocProxyFactory = await ethers.getContractFactory("MocCACoinbase");
      const initParams = [
        governorMock.address,
        deployer,
        deployer,
        deployer,
        coreParams.ctarg,
        coreParams.protThrld,
        tcParams.mintFee,
        tcParams.redeemFee,
        coreParams.emaCalculationBlockSpan,
      ];
      mocProxy = await upgrades.deployProxy(mocProxyFactory, initParams, {
        kind: "uups",
      });
    });
    describe("WHEN it is upgraded to a new implementation", () => {
      it("THEN it succeeds as it is consistent with the previous storage", async () => {
        const mocCoinbaseMockFactory = await ethers.getContractFactory("MocCoinbaseMock");
        await upgrades.upgradeProxy(mocProxy.address, mocCoinbaseMockFactory);
      });
    });
  });
});
