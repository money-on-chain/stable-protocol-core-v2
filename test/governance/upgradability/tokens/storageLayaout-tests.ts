import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { MocTC, MocTC__factory } from "../../../../typechain";
import { GAS_LIMIT_PATCH } from "../../../helpers/utils";

describe("Feature: Check MocTC storage layout compatibility using openzeppelin hardhat upgrade ", () => {
  let mocTC: MocTC;
  describe("GIVEN a Moc Collateral Token is deployed", () => {
    before(async () => {
      const governorMockFactory = await ethers.getContractFactory("GovernorMock");
      const governorMock = await governorMockFactory.deploy();

      const mocTCFactory = await ethers.getContractFactory("MocTC");

      const mocTCProxy = await upgrades.deployProxy(mocTCFactory, undefined, {
        kind: "uups",
        initializer: false,
      });

      mocTC = MocTC__factory.connect(mocTCProxy.address, ethers.provider.getSigner());
      await mocTC.initialize("UUPS Test", "UTM", governorMock.address, governorMock.address, {
        gasLimit: GAS_LIMIT_PATCH,
      });
    });
    describe("WHEN it is upgraded to a new implementation", () => {
      it("THEN it succeeds as it is consistent with the previous storage", async () => {
        const mocTCMockFactory = await ethers.getContractFactory("MocTcMock");
        await expect(await mocTC.totalSupply()).to.be.equal(0);
        await upgrades.upgradeProxy(mocTC.address, mocTCMockFactory);
        await expect(await mocTC.totalSupply()).to.be.equal(1);
      });
    });
  });
});
