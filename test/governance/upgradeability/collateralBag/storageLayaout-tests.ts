import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";

import { fixtureDeployedMocCABag } from "../../../collateralBag/fixture";
import { tpParams } from "../../../helpers/utils";

describe("Feature: Check MocCAWrapper storage layout compatibility using openzeppelin hardhat upgrade ", () => {
  let mocProxy: Contract;
  describe("GIVEN a MocCAWrapper Proxy is deployed", () => {
    before(async () => {
      const fixtureDeploy = fixtureDeployedMocCABag(tpParams.length, tpParams);
      ({ mocWrapper: mocProxy } = await fixtureDeploy());
    });
    describe("WHEN it is upgraded to a new implementation", () => {
      it("THEN it succeeds as it is consistent with the previous storage", async () => {
        const mocCAWrapperFactory = await ethers.getContractFactory("MocCAWrapper");
        const mocCAWrapperMockFactory = await ethers.getContractFactory("MocCAWrapperMock");
        // forces the import of an existing proxy to be used with this plugin
        await upgrades.forceImport(mocProxy.address, mocCAWrapperFactory);
        await upgrades.upgradeProxy(mocProxy.address, mocCAWrapperMockFactory, {
          // FIXME: this is needed because of this issue: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/455
          unsafeAllow: ["delegatecall"],
        });
      });
    });
  });
});
