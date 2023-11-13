import { expect } from "chai";
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { Contract } from "ethers";

import { MocCACoinbase, MocRC20, MocTcMock, MocTcMock__factory } from "../../../../typechain";
import { fixtureDeployedMocCoinbase } from "../../../coinbase/fixture";
import { deployAeropagusGovernor, ERRORS, tpParams } from "../../../helpers/utils";

describe("Feature: MocRC20 Upgradeability UUPS", () => {
  let mocTCProxy: MocRC20;
  let mocImpl: MocCACoinbase;
  let mocTCProxyAsTCMock: MocTcMock;
  let mocTCMockImpl: Contract;
  let governor: Contract;
  let changeContract: Contract;
  let wrongChangeContract: Contract;

  before(async () => {
    const { deployer } = await getNamedAccounts();
    const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
    ({ mocCollateralToken: mocTCProxy, mocImpl } = await fixtureDeploy());

    // set a real governor
    governor = await deployAeropagusGovernor(deployer);
    await mocTCProxy.changeGovernor(governor.address);

    const mocTCMockFactory = await ethers.getContractFactory("MocTcMock");
    mocTCMockImpl = await mocTCMockFactory.deploy();

    const changerFactory = await ethers.getContractFactory("MocUpgradeChangerMock");
    changeContract = await changerFactory.deploy(mocTCProxy.address, mocTCMockImpl.address);

    wrongChangeContract = await changerFactory.deploy(
      (
        await deployments.get("CollateralTokenCARC20Proxy")
      ).implementation!,
      mocTCMockImpl.address,
    );

    // mint 10 TC
    await mocImpl.mintTC(10, { value: 100 });
  });

  describe("GIVEN a Changer contract is set up to upgrade MocRC20", () => {
    describe("WHEN update the contract calling the implementation", () => {
      it("THEN tx reverts because update only can be called by a proxy", async () => {
        await expect(governor.executeChange(wrongChangeContract.address)).to.be.revertedWith(
          "Function must be called through delegatecall",
        );
      });
    });
    describe("WHEN the governor didn't authorize the upgrade", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async () => {
        await expect(mocTCProxy.upgradeTo(mocTCMockImpl.address)).to.be.revertedWithCustomError(
          mocTCProxy,
          ERRORS.NOT_AUTH_CHANGER,
        );
      });
    });
    describe("WHEN the owner updates the contract through governance", () => {
      before(async function () {
        await governor.executeChange(changeContract.address);
        mocTCProxyAsTCMock = MocTcMock__factory.connect(mocTCProxy.address, ethers.provider.getSigner());
      });
      it("THEN the new method and values are returned correctly", async function () {
        const newVariable = await mocTCProxyAsTCMock.newVariable();
        expect(newVariable).to.be.equal(42);

        // This method returns the sum of and "old" state variable (totalSupply) and the newVariable
        const newAndOldVariable = await mocTCProxyAsTCMock.totalSupply();
        expect(newAndOldVariable).to.be.equal(53);
      });
    });
  });
});
