import { expect } from "chai";
import { ethers, getNamedAccounts } from "hardhat";
import { fixtureDeployedMocCoinbase } from "../../coinbase/fixture";
import { GovernorMock, MocCACoinbase, GovernorMock__factory } from "../../../typechain";
import { ERRORS } from "../../helpers/utils";
import { mocFunctionsCoinbase } from "../../helpers/mocFunctionsCoinbase";
import { Address } from "hardhat-deploy/types";

const fixtureDeploy = fixtureDeployedMocCoinbase(1);

describe("Feature: Verify pausing mechanism and restrictions", () => {
  let mocContracts: any;
  let mocFunctions: any;
  let mocImpl: MocCACoinbase;
  let governorMock: GovernorMock;
  let pauser: Address;
  let alice: Address;

  const expectPauseRevert = async (result: any) =>
    expect(result).to.be.revertedWithCustomError(mocImpl, ERRORS.NOT__WHEN_PAUSED);

  before(async () => {
    mocContracts = await fixtureDeploy();
    ({ mocImpl } = mocContracts);
    mocFunctions = await mocFunctionsCoinbase(mocContracts);

    ({ deployer: pauser, alice } = await getNamedAccounts());
    const governorAddress = await mocImpl.governor();
    governorMock = GovernorMock__factory.connect(governorAddress, ethers.provider.getSigner());
  });

  describe("GIVEN the Pauser, pauses the system", () => {
    before(async () => {
      await governorMock.setIsAuthorized(true);
      await mocImpl.setPauser(pauser);
      await mocImpl.makeStoppable();
      await mocImpl.connect(await ethers.getSigner(pauser)).pause();
    });
    describe(`WHEN someone tries to mintTC`, () => {
      it("THEN it fails, as the system is paused", async function () {
        await expectPauseRevert(mocFunctions.mintTC({ from: alice, qTC: 10 }));
      });
    });
    describe(`WHEN someone tries to mintTP`, () => {
      it("THEN it fails, as the system is paused", async function () {
        await expectPauseRevert(mocFunctions.mintTP({ from: alice, qTP: 10 }));
      });
    });
    describe(`WHEN someone tries to redeemTC`, () => {
      it("THEN it fails, as the system is paused", async function () {
        await expectPauseRevert(mocFunctions.redeemTC({ from: alice, qTC: 10 }));
      });
    });
    describe(`WHEN someone tries to redeemTP`, () => {
      it("THEN it fails, as the system is paused", async function () {
        await expectPauseRevert(mocFunctions.redeemTP({ from: alice, qTP: 10 }));
      });
    });
    describe(`WHEN someone tries to swapTPforTP`, () => {
      it("THEN it fails, as the system is paused", async function () {
        await expectPauseRevert(mocFunctions.swapTPforTP({ iFrom: 0, iTo: 1, from: alice, qTP: 10 }));
      });
    });
  });
});
