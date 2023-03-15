import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Contract } from "ethers";

import { MocCACoinbase, MocCoinbaseMock, MocCoinbaseMock__factory } from "../../../../typechain";
import { fixtureDeployGovernance } from "./fixture";

const fixtureDeploy = fixtureDeployGovernance();

describe("Feature: MocCoinbase Upgradeability UUPS", () => {
  let mocProxy: MocCACoinbase;
  let mocProxyAsCoinbaseMock: MocCoinbaseMock;
  let governor: Contract;
  let changeContract: Contract;
  let wrongChangeContract: Contract;

  before(async () => {
    ({ mocCACoinbase: mocProxy, governor } = await fixtureDeploy());

    const MocCoinbaseMockFactory = await ethers.getContractFactory("MocCoinbaseMock");
    const mocCoinbaseMockImpl = await MocCoinbaseMockFactory.deploy();

    const changerFactory = await ethers.getContractFactory("MocUpgradeChangerMock");
    changeContract = await changerFactory.deploy(mocProxy.address, mocCoinbaseMockImpl.address);

    wrongChangeContract = await changerFactory.deploy(
      (
        await deployments.get("MocCACoinbaseProxy")
      ).implementation!,
      mocCoinbaseMockImpl.address,
    );
  });

  describe("GIVEN a Changer contract is set up to upgrade MocCoinbase", () => {
    describe("WHEN update the contract calling the implementation", () => {
      it("THEN tx reverts because update only can be called by a proxy", async () => {
        await expect(governor.executeChange(wrongChangeContract.address)).to.be.revertedWith(
          "Function must be called through delegatecall",
        );
      });
    });
    describe("WHEN the owner updates the contract through governance", () => {
      before(async function () {
        await governor.executeChange(changeContract.address);
        mocProxyAsCoinbaseMock = MocCoinbaseMock__factory.connect(mocProxy.address, ethers.provider.getSigner());
      });
      it("THEN the new method and values are returned correctly", async function () {
        const newVariable = await mocProxyAsCoinbaseMock.newVariable();
        expect(newVariable).to.be.equal(42);

        // This method returns the sum of and "old" state variable (protThrld) and the newVariable
        const newAndOldVariable = await mocProxyAsCoinbaseMock.getCustomMockValue();
        expect(newAndOldVariable).to.be.equal(44);
      });
    });
  });
});
