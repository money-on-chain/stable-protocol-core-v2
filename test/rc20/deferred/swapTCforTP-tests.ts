import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { MocCARC20Deferred } from "../../../typechain";
import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { swapTCforTPBehavior } from "../../behaviors/swapTCforTP.behavior";
import { tpParams } from "../../helpers/utils";
import { assertPrec } from "../../helpers/assertHelper";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocCARC20Deferred swap TC for TP", function () {
  let mocImpl: MocCARC20Deferred;
  let mocFunctions: any;
  let alice: Address;
  describe("GIVEN a MocCARC20Deferred implementation deployed", function () {
    beforeEach(async function () {
      ({ alice } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({ mocImpl } = this.mocContracts);
    });
    swapTCforTPBehavior();

    describe("GIVEN Alice has 20 TC", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 100 });
      });
      describe("WHEN she registers an Operation to swap 12 TC", function () {
        beforeEach(async function () {
          await mocFunctions.swapTCforTP({ from: alice, qTC: 12, execute: false });
        });
        it("THEN Alice TC balance decreases by 12, as her funds are locked", async function () {
          assertPrec(await mocFunctions.tcBalanceOf(alice), 88);
        });
        it("THEN Bucket balance increases by 12, as the funds are now locked there", async function () {
          assertPrec(await mocFunctions.tcBalanceOf(mocImpl.address), 12);
        });
        describe("WHEN the operation is executed", function () {
          beforeEach(async function () {
            await mocFunctions.executeLastOperation();
          });
          it("THEN Alice TC balance doesn't change", async function () {
            assertPrec(await mocFunctions.tcBalanceOf(alice), 88);
          });
          it("THEN Bucket TC balance is back to zero as tokes were burned", async function () {
            assertPrec(await mocFunctions.tcBalanceOf(mocImpl.address), 0);
          });
        });
      });
    });
  });
});
