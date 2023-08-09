import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { MocCARC20Deferred } from "../../../typechain";
import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { redeemTPBehavior } from "../../behaviors/redeemTP.behavior";
import { tpParams } from "../../helpers/utils";
import { assertPrec } from "../../helpers/assertHelper";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocCARC20Deferred redeem TP", function () {
  let mocImpl: MocCARC20Deferred;
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;

  describe("GIVEN a MocCARC20Deferred implementation deployed", function () {
    beforeEach(async function () {
      ({ alice, bob } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({ mocImpl } = this.mocContracts);
    });
    redeemTPBehavior();

    describe("GIVEN Alice has 20 TP", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: bob, qTC: 100 });
        await mocFunctions.mintTP({ from: alice, qTP: 20 });
      });
      describe("WHEN she registers an Operation to redeems 12 TP", function () {
        beforeEach(async function () {
          await mocFunctions.redeemTP({ from: alice, qTP: 12, execute: false });
        });
        it("THEN Alice TP balance decreases by 12, as her funds are locked", async function () {
          assertPrec(await mocFunctions.tpBalanceOf(TP_0, alice), 8);
        });
        it("THEN Bucket balance increases by 12, as the funds are now locked there", async function () {
          assertPrec(await mocFunctions.tpBalanceOf(TP_0, mocImpl.address), 12);
        });
        describe("WHEN the operation is executed", function () {
          beforeEach(async function () {
            await mocFunctions.executeLastOperation();
          });
          it("THEN Alice TP balance doesn't change", async function () {
            assertPrec(await mocFunctions.tpBalanceOf(TP_0, alice), 8);
          });
          it("THEN Bucket TP balance is back to zero as tokes were burned", async function () {
            assertPrec(await mocFunctions.tpBalanceOf(TP_0, mocImpl.address), 0);
          });
        });
      });
    });
  });
});
