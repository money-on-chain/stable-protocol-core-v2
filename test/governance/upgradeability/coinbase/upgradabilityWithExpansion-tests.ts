import { expect } from "chai";
import { ethers, getNamedAccounts } from "hardhat";
import { Contract } from "ethers";

import {
  MocCACoinbase,
  MocCoinbaseWithExpansionMock,
  MocCoinbaseWithExpansionMock__factory,
} from "../../../../typechain";
import { fixtureDeployedMocCoinbase } from "../../../coinbase/fixture";
import { deployAeropagusGovernor, tpParams } from "../../../helpers/utils";

describe("Feature: MocCoinbase Upgradeability UUPS", () => {
  let mocProxy: MocCACoinbase;
  let mocProxyAsCoinbaseMock: MocCoinbaseWithExpansionMock;
  let governor: Contract;
  let changeContractWithExpansion: Contract;

  before(async () => {
    const { deployer } = await getNamedAccounts();
    const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
    ({ mocImpl: mocProxy } = await fixtureDeploy());

    // set a real governor
    governor = await deployAeropagusGovernor(deployer);
    await mocProxy.changeGovernor(governor.address);

    const MocCoinbaseMockFactory = await ethers.getContractFactory("MocCoinbaseWithExpansionMock");
    const mocCoinbaseMockImpl = await MocCoinbaseMockFactory.deploy();

    const MocCoreExpansionMockFactory = await ethers.getContractFactory("MocCoreExpansionMock");
    const mocCoreExpansionMock = await MocCoreExpansionMockFactory.deploy();

    const changerWithExpansionFactory = await ethers.getContractFactory("MocUpgradeChangerWithExpansionMock");
    changeContractWithExpansion = await changerWithExpansionFactory.deploy(
      mocProxy.address,
      mocCoinbaseMockImpl.address,
      mocCoreExpansionMock.address,
    );
  });

  describe("GIVEN a Changer contract and a new MocCoreExpansion are set up to upgrade MocCoinbase", () => {
    describe("WHEN the owner updates the contract through governance", () => {
      before(async () => {
        await governor.executeChange(changeContractWithExpansion.address);
        mocProxyAsCoinbaseMock = MocCoinbaseWithExpansionMock__factory.connect(
          mocProxy.address,
          ethers.provider.getSigner(),
        );
      });
      it("THEN the new method and values are returned correctly", async function () {
        const newVariable = await mocProxyAsCoinbaseMock.newVariable();
        expect(newVariable).to.be.equal(52);

        // This method returns the sum of and "old" state variable (protThrld) and the newVariable
        const newAndOldVariable = await mocProxyAsCoinbaseMock.getCustomMockValue();
        expect(newAndOldVariable).to.be.equal(54);

        // This method returns the sum of and "old" state variable (protThrld) and the newVariable using the new MocCoreExpansion
        const newAndOldVariableWithExpansion = await mocProxyAsCoinbaseMock.callStatic.getExpansionCustomMockValue();
        expect(newAndOldVariableWithExpansion).to.be.equal(54);
      });
    });
  });
});
