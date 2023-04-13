import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { tpParams } from "../../../helpers/utils";
import { fixtureDeployedMocCoinbase } from "../../../coinbase/fixture";

describe("Feature: Check MocCoinbase storage layout compatibility using openzeppelin hardhat upgrade ", () => {
  let mocProxy: Contract;
  describe("GIVEN a Moc Proxy is deployed", () => {
    beforeEach(async () => {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
      ({ mocImpl: mocProxy } = await fixtureDeploy());
    });
    describe("WHEN it is upgraded to a new implementation", () => {
      it("THEN it succeeds as it is consistent with the previous storage", async () => {
        const mocCoinbaseMockFactory = await ethers.getContractFactory("MocCoinbaseMock");
        // forces the import of an existing proxy to be used with this plugin
        await upgrades.forceImport(mocProxy.address, mocCoinbaseMockFactory);
        await upgrades.upgradeProxy(mocProxy.address, mocCoinbaseMockFactory, {
          // we allow delegatecall to use MocCoreExpansion
          unsafeAllow: ["delegatecall"],
        });
      });
    });
    describe("WHEN check storage layout compatibility between MocCore and MocCoreExpansion", () => {
      // this test will fail if new storage variables are declare in MocCore.sol or MocCoreExtension.sol
      it("THEN it succeeds as there is not storage collision", async () => {
        const mocCoinbaseFactory = await ethers.getContractFactory("MocCACoinbase");
        const mocCoreExpansionFactory = await ethers.getContractFactory("MocCoreExpansion");
        await upgrades.validateUpgrade(mocCoreExpansionFactory, mocCoinbaseFactory, {
          // we allow delegatecall to use MocCoreExpansion
          unsafeAllow: ["delegatecall"],
        });
      });
    });
  });
});
