import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Contract } from "ethers";

import { MocCARC20, MocCARC20Mock, MocCARC20Mock__factory } from "../../../../typechain";
import { fixtureDeployGovernance } from "./fixture";

const fixtureDeploy = fixtureDeployGovernance();

describe("Feature: MocRC20 Upgradeability UUPS", () => {
  let mocProxy: MocCARC20;
  let mocProxyAsRC20Mock: MocCARC20Mock;
  let governor: Contract;
  let changeContract: Contract;
  let wrongChangeContract: Contract;

  before(async () => {
    ({ mocCARC20: mocProxy, governor } = await fixtureDeploy());

    const mocRC20MockFactory = await ethers.getContractFactory("MocCARC20Mock");
    const mocRC20MockImpl = await mocRC20MockFactory.deploy();

    const changerFactory = await ethers.getContractFactory("MocUpgradeChangerMock");
    changeContract = await changerFactory.deploy(mocProxy.address, mocRC20MockImpl.address);

    wrongChangeContract = await changerFactory.deploy(
      (
        await deployments.get("MocCARC20Proxy")
      ).implementation!,
      mocRC20MockImpl.address,
    );
  });

  describe("GIVEN a Changer contract is set up to upgrade MocRC20", () => {
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
        mocProxyAsRC20Mock = MocCARC20Mock__factory.connect(mocProxy.address, ethers.provider.getSigner());
      });
      it("THEN the new method and values are returned correctly", async function () {
        const newVariable = await mocProxyAsRC20Mock.newVariable();
        expect(newVariable).to.be.equal(42);

        // This method returns the sum of and "old" state variable (protThrld) and the newVariable
        const newAndOldVariable = await mocProxyAsRC20Mock.getCustomMockValue();
        expect(newAndOldVariable).to.be.equal(44);
      });
    });
  });
});
