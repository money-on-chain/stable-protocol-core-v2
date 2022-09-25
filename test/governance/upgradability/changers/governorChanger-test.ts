import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

import { fixtureDeployGovernance } from "../coinbase/fixture";
import { MocCACoinbase } from "../../../../typechain";
import { GovernanceChangerTemplate__factory } from "../../../../typechain/factories/contracts/governance/changerTemplates/GovernanceChangerTemplate__factory";
import { ERRORS } from "../../../helpers/utils";

const fixtureDeploy = fixtureDeployGovernance();

describe("Feature: Change MocCore Governor", () => {
  let mocProxy: MocCACoinbase;
  let governor: Contract;
  let changeContract: Contract;
  let governorMock: Contract;

  before(async () => {
    ({ mocCACoinbase: mocProxy, governor } = await fixtureDeploy());

    const governorMockFactory = await ethers.getContractFactory("GovernorMock");
    governorMock = await governorMockFactory.deploy();

    const changerFactory = await ethers.getContractFactory("GovernanceChangerTemplate");
    changeContract = await changerFactory.deploy(mocProxy.address, governorMock.address);
  });

  describe("GIVEN a Changer contract is set up to change Governor", () => {
    describe("WHEN a unauthorized account executed the changer", () => {
      it("THEN it fails", async function () {
        const governanceChangerTemplate = GovernanceChangerTemplate__factory.connect(
          changeContract.address,
          ethers.provider.getSigner(),
        );
        await expect(governanceChangerTemplate.execute()).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.NOT_AUTH_CHANGER,
        );
      });
    });
    describe("WHEN a the governor executes the changer contract", () => {
      it("THEN the new governor is assigned", async function () {
        await governor.executeChange(changeContract.address);
        const newGovernor = await mocProxy.governor();
        expect(newGovernor).to.be.equal(governorMock.address);
      });
    });
  });
});
