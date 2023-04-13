import { expect } from "chai";
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { Contract } from "ethers";

import { MocCAWrapper, MocCAWrapperMock, MocCAWrapperMock__factory } from "../../../../typechain";
import { fixtureDeployedMocCABag } from "../../../collateralBag/fixture";
import { deployAeropagusGovernor, ERRORS, tpParams } from "../../../helpers/utils";

describe("Feature: MocCAWrapper Upgradeability UUPS", () => {
  let mocProxy: MocCAWrapper;
  let mocProxyAsRC20Mock: MocCAWrapperMock;
  let MocCAWrapperMockImpl: Contract;
  let governor: Contract;
  let changeContract: Contract;
  let wrongChangeContract: Contract;

  before(async () => {
    const { deployer } = await getNamedAccounts();
    const fixtureDeploy = fixtureDeployedMocCABag(tpParams.length, tpParams);
    ({ mocWrapper: mocProxy } = await fixtureDeploy());

    // set a real governor
    governor = await deployAeropagusGovernor(deployer);
    await mocProxy.changeGovernor(governor.address);

    const MocCAWrapperMockFactory = await ethers.getContractFactory("MocCAWrapperMock");
    MocCAWrapperMockImpl = await MocCAWrapperMockFactory.deploy();

    const changerFactory = await ethers.getContractFactory("MocUpgradeChangerMock");
    changeContract = await changerFactory.deploy(mocProxy.address, MocCAWrapperMockImpl.address);

    wrongChangeContract = await changerFactory.deploy(
      (
        await deployments.get("MocCAWrapperProxy")
      ).implementation!,
      MocCAWrapperMockImpl.address,
    );
  });

  describe("GIVEN a Changer contract is set up to upgrade MocCAWrapper", () => {
    describe("WHEN update the contract calling the implementation", () => {
      it("THEN tx reverts because update only can be called by a proxy", async () => {
        await expect(governor.executeChange(wrongChangeContract.address)).to.be.revertedWith(
          "Function must be called through delegatecall",
        );
      });
    });
    describe("WHEN the governor didn't authorize the upgrade", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async () => {
        await expect(mocProxy.upgradeTo(MocCAWrapperMockImpl.address)).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.NOT_AUTH_CHANGER,
        );
      });
    });
    describe("WHEN the owner updates the contract through governance", () => {
      before(async function () {
        await governor.executeChange(changeContract.address);
        mocProxyAsRC20Mock = MocCAWrapperMock__factory.connect(mocProxy.address, ethers.provider.getSigner());
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
