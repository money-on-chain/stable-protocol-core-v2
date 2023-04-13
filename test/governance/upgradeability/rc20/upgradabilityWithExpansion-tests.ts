import { expect } from "chai";
import { ethers, getNamedAccounts } from "hardhat";
import { Contract } from "ethers";

import { MocCARC20, MocCARC20WithExpansionMock, MocCARC20WithExpansionMock__factory } from "../../../../typechain";
import { fixtureDeployedMocRC20 } from "../../../rc20/fixture";
import { deployAeropagusGovernor, tpParams } from "../../../helpers/utils";

describe("Feature: MocRC20 Upgradeability UUPS", () => {
  let mocProxy: MocCARC20;
  let mocProxyAsRC20Mock: MocCARC20WithExpansionMock;
  let governor: Contract;
  let changeContractWithExpansion: Contract;

  before(async () => {
    const { deployer } = await getNamedAccounts();
    const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams);
    ({ mocImpl: mocProxy } = await fixtureDeploy());

    // set a real governor
    governor = await deployAeropagusGovernor(deployer);
    await mocProxy.changeGovernor(governor.address);

    const mocRC20MockFactory = await ethers.getContractFactory("MocCARC20WithExpansionMock");
    const mocRC20MockImpl = await mocRC20MockFactory.deploy();

    const MocCoreExpansionMockFactory = await ethers.getContractFactory("MocCoreExpansionMock");
    const mocCoreExpansionMock = await MocCoreExpansionMockFactory.deploy();

    const changerWithExpansionFactory = await ethers.getContractFactory("MocUpgradeChangerWithExpansionMock");
    changeContractWithExpansion = await changerWithExpansionFactory.deploy(
      mocProxy.address,
      mocRC20MockImpl.address,
      mocCoreExpansionMock.address,
    );
  });

  describe("GIVEN a Changer contract and a new MocCoreExpansion are set up to upgrade MocRC20", () => {
    describe("WHEN the owner updates the contract through governance", () => {
      before(async () => {
        await governor.executeChange(changeContractWithExpansion.address);
        mocProxyAsRC20Mock = MocCARC20WithExpansionMock__factory.connect(mocProxy.address, ethers.provider.getSigner());
      });
      it("THEN the new method and values are returned correctly", async function () {
        const newVariable = await mocProxyAsRC20Mock.newVariable();
        expect(newVariable).to.be.equal(52);
        // This method returns the sum of and "old" state variable (protThrld) and the newVariable
        const newAndOldVariable = await mocProxyAsRC20Mock.getCustomMockValue();
        expect(newAndOldVariable).to.be.equal(54);

        // This method returns the sum of and "old" state variable (protThrld) and the newVariable using the new MocCoreExpansion
        const newAndOldVariableWithExpansion = await mocProxyAsRC20Mock.callStatic.getExpansionCustomMockValue();
        expect(newAndOldVariableWithExpansion).to.be.equal(54);
      });
    });
  });
});
