import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { MocCARC20Deferred } from "../../../typechain";
import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { redeemTCandTPBehavior } from "../../behaviors/redeemTCandTP.behavior";
import { tpParams } from "../../helpers/utils";
import { assertPrec } from "../../helpers/assertHelper";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocCARC20Deferred redeem TC and TP", function () {
  let mocImpl: MocCARC20Deferred;
  let mocFunctions: any;
  let alice: Address;
  const TP_0 = 0;

  describe("GIVEN a MocCARC20Deferred implementation deployed", function () {
    beforeEach(async function () {
      ({ alice } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({ mocImpl } = this.mocContracts);
    });
    redeemTCandTPBehavior();

    describe("GIVEN alice has 3000 TC, 23500 TP 0", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 3000 });
        await mocFunctions.mintTP({ from: alice, qTP: 23500 });
      });
      describe("WHEN she registers a joint redeem Operation of 100 TC and max 800 TP", function () {
        beforeEach(async function () {
          await mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 800, execute: false });
        });
        it("THEN Alice both TP and TC balances decreases, as her funds are locked", async function () {
          assertPrec(await mocFunctions.tcBalanceOf(alice), 3000 - 100);
          assertPrec(await mocFunctions.tpBalanceOf(TP_0, alice), 23500 - 800);
        });
        it("THEN Bucket both TP and TC balances increases, as the funds are now locked there", async function () {
          assertPrec(await mocFunctions.tcBalanceOf(mocImpl.address), 100);
          assertPrec(await mocFunctions.tpBalanceOf(TP_0, mocImpl.address), 800);
        });
        describe("WHEN the operation is executed", function () {
          beforeEach(async function () {
            await mocFunctions.executeLastOperation();
          });
          it("THEN Alice TC balance doesn't change as all is redeemed", async function () {
            assertPrec(await mocFunctions.tcBalanceOf(alice), 3000 - 100);
          });
          it("THEN Alice received the TP change, as she only redeemed 783.33 TP", async function () {
            assertPrec(await mocFunctions.tpBalanceOf(TP_0, alice), "22716.666666666666666667");
          });
          it("THEN Bucket balances are back to zero as tokes were burned or returned", async function () {
            assertPrec(await mocFunctions.tcBalanceOf(mocImpl.address), 0);
            assertPrec(await mocFunctions.tpBalanceOf(TP_0, mocImpl.address), 0);
          });
        });
      });
    });
  });
});
