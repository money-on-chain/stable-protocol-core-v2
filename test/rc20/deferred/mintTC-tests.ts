import { expect } from "chai";
import { getNamedAccounts } from "hardhat";
import { Address } from "hardhat-deploy/types";
import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { mintTCBehavior } from "../../behaviors/mintTC.behavior";
import { CONSTANTS, tpParams } from "../../helpers/utils";
import { MocCARC20Deferred } from "../../../typechain";
import { assertPrec } from "../../helpers/assertHelper";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocCARC20Deferred mint TC", function () {
  let mocImpl: MocCARC20Deferred;
  let mocFunctions: any;
  let deployer: Address;

  describe("GIVEN a MocCARC20Deferred implementation deployed", function () {
    beforeEach(async function () {
      ({ deployer } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({ mocImpl } = this.mocContracts);
    });
    mintTCBehavior();

    describe("WHEN an user sends almost max uint256 amount of Asset to mint TC", function () {
      it("THEN tx reverts with panic code 0x11 overflow", async function () {
        const qACmax = CONSTANTS.MAX_BALANCE;
        const qTC = CONSTANTS.MAX_BALANCE;
        await expect(
          mocFunctions.mintTC({ from: deployer, qTC, qACmax, applyPrecision: false }),
        ).to.be.revertedWithPanic("0x11");
      });
    });

    describe("WHEN an user registers a mint 10 TC operation, sending 100 AC", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: deployer, qTC: 10, qACmax: 100, execute: false });
      });
      it("THEN nACcb is 0 AC", async function () {
        assertPrec(await mocImpl.nACcb(), 0);
      });
      it("THEN AC balance locked is 100 AC", async function () {
        assertPrec(await mocImpl.acBalanceLocked(), 100);
      });
      describe("AND refreshACBalance is called", function () {
        beforeEach(async function () {
          await mocImpl.refreshACBalance();
        });
        it("THEN nACcb is still 0 AC", async function () {
          assertPrec(await mocImpl.nACcb(), 0);
        });
        it("THEN AC balance locked is still 100 AC", async function () {
          assertPrec(await mocImpl.acBalanceLocked(), 100);
        });
      });
      describe("AND operation is executed", function () {
        beforeEach(async function () {
          await mocFunctions.executeLastOperation();
        });
        it("THEN nACcb is 10 AC", async function () {
          assertPrec(await mocImpl.nACcb(), 10);
        });
        it("THEN AC balance locked is 0 AC", async function () {
          assertPrec(await mocImpl.acBalanceLocked(), 0);
        });
      });
    });
  });
});
