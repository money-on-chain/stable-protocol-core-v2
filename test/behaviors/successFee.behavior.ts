import { getNamedAccounts } from "hardhat";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { ERRORS, mineUpTo } from "../helpers/utils";
import { expect } from "chai";
import { beforeEach } from "mocha";

const successFeeBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let alice: Address;
  let nextBlockSettlement: number;

  describe("Feature: success fee distribution", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ alice } = await getNamedAccounts());
    });
    describe("GIVEN alice has open positions", function () {
      beforeEach(async function () {
        /*
          nAC = 10000 + 100 + 20 + 10
          lckAC = 130
          */
        await mocFunctions.mintTC({ from: alice, qTC: 10000 });
        await Promise.all([23500, 105, 9345.8].map((qTP, i) => mocFunctions.mintTP({ i, from: alice, qTP })));
      });
      describe("WHEN ask for the TC price", function () {
        it("THEN it is 1", async function () {
          assertPrec(1, await mocContracts.mocImpl.getPTCac());
        });
      });
      describe("WHEN an unauthorized account executes the settlement function in Moc Core", function () {
        it("THEN fails because only settlement contract can execute it", async function () {
          await expect(mocContracts.mocImpl.execSettlement()).to.be.revertedWithCustomError(
            mocContracts.mocImpl,
            ERRORS.ONLY_SETTLEMENT,
          );
        });
      });
      describe("AND the settlement is executed", function () {
        beforeEach(async function () {
          nextBlockSettlement = await mocContracts.mocSettlement.bns();
          await mineUpTo(nextBlockSettlement);
          await mocContracts.mocSettlement.execSettlement();
        });
        describe("WHEN ask for the TC price", function () {
          it("THEN it is still 1 because the prices had not changed", async function () {
            assertPrec(1, await mocContracts.mocImpl.getPTCac());
          });
          // TODO: check nothing distributed to turbo or moc flow
        });
        describe("AND TPs have been devalued 100%, 50% and 25% respectively", function () {
          beforeEach(async function () {
            await Promise.all([470, 7.875, 1168.225].map((price, i) => mocFunctions.pokePrice(i, price)));
          });
          describe("WHEN ask for the TC price", function () {
            /*
              nAC = 10000 + 100 + 20 + 10
              lckACLst = 130
              lckAC = 50 + 13.33 + 8
              nACToMin = (130 - 71.33) * 0.6 = 35.202
              pTCac = 10130 - 35.202 - 71.33 / 10000 = 1.0023
              */
            it("THEN it is 1.0023", async function () {
              assertPrec("1.002346666666666666", await mocContracts.mocImpl.getPTCac());
            });
          });
          describe("AND another settlement is executed", function () {
            beforeEach(async function () {
              nextBlockSettlement = await mocContracts.mocSettlement.bns();
              await mineUpTo(nextBlockSettlement);
              await mocContracts.mocSettlement.execSettlement();
            });
            // TODO: check TP and AC distributed to turbo and moc flow
            // TODO: check new TC price
          });
        });
      });
    });
  });
};

export { successFeeBehavior };
