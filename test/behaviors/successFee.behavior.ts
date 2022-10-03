import { getNamedAccounts } from "hardhat";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { Balance } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";
import { ERRORS, mineUpTo } from "../helpers/utils";
import { expect } from "chai";
import { beforeEach } from "mocha";

const successFeeBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let alice: Address;
  let nextBlockSettlement: number;
  const TP_0 = 0;
  const TP_1 = 1;
  const TP_2 = 2;
  const { mocFeeFlowAddress, mocTurboAddress } = mocAddresses["hardhat"];

  describe("Feature: success fee distribution", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ alice } = await getNamedAccounts());
    });
    describe("GIVEN alice has open positions", function () {
      beforeEach(async function () {
        /*
          nAC = 1000 + 100 + 20 + 10
          lckAC = 130
          */
        await mocFunctions.mintTC({ from: alice, qTC: 1000 });
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
        let mocPrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        let mocTurboPrevTPsBalance: Balance[];
        beforeEach(async function () {
          nextBlockSettlement = await mocContracts.mocSettlement.bns();
          await mineUpTo(nextBlockSettlement);
          await mocContracts.mocSettlement.execSettlement();
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          mocTurboPrevTPsBalance = await Promise.all(
            [TP_0, TP_1, TP_2].map(i => mocFunctions.tpBalanceOf(i, mocTurboAddress)),
          );
        });
        describe("WHEN ask for the TC price", function () {
          it("THEN it is still 1 because the prices had not changed", async function () {
            assertPrec(1, await mocContracts.mocImpl.getPTCac());
          });
        });
        it("THEN Moc balance AC balance didn't change", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          const diff = mocActualACBalance.sub(mocPrevACBalance);
          assertPrec(0, diff);
        });
        it("THEN Moc Turbo TP balance didn't change", async function () {
          const mocTurboActualTPsBalance = await Promise.all(
            [TP_0, TP_1, TP_2].map(i => mocFunctions.tpBalanceOf(i, mocTurboAddress)),
          );
          mocTurboActualTPsBalance.forEach((value, i) => {
            const diff = value.sub(mocTurboPrevTPsBalance[i]);
            assertPrec(0, diff);
          });
        });
        it("THEN Moc Fee Flow AC balance didn't change", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(0, diff);
        });
        describe("AND TPs have been devalued 100%, 50% and 25% respectively", function () {
          beforeEach(async function () {
            await Promise.all([470, 7.875, 1168.225].map((price, i) => mocFunctions.pokePrice(i, price)));
          });
          describe("WHEN ask for the TC price", function () {
            /*
              nAC = 1000 + 100 + 20 + 10
              lckACLst = 130
              lckAC = 50 + 13.33 + 8
              nACToMin = (130 - 71.33) * 0.6 = 35.202
              pTCac = 1130 - 35.202 - 71.33 / 1000 = 1.023
              */
            it("THEN it is 1.023", async function () {
              assertPrec("1.023466666666666666", await mocContracts.mocImpl.getPTCac());
            });
          });
          describe("AND another settlement is executed", function () {
            beforeEach(async function () {
              nextBlockSettlement = await mocContracts.mocSettlement.bns();
              await mineUpTo(nextBlockSettlement);
              await mocContracts.mocSettlement.execSettlement();
            });
            describe("WHEN ask for the TC price", function () {
              /*
                nAC = 1130 - 5.86
                lckACLst = 71.33
                lckAC = 71.33 + 25 + 3.33 + 1
                nACToMin = 0
                pTCac = 1124.14 - 0 - 100.66 / 1000 = 1.023
                TP1 minted to Turbo = (100 - 50) * 0.5 * 470 = 11750
                TP2 Minted to Turbo = (20 - 13.33) * 0.5 * 7.875 = 26.24
                TP3 Minted to Turbo = (10 - 8) * 0.5 * 1168.225 = 1168.225
                */
              it("THEN it is 1.023", async function () {
                assertPrec("1.023466666666666666", await mocContracts.mocImpl.getPTCac());
              });
            });
            it("THEN Moc balance AC decrease 5.86 AC, 10% of ACtoMint", async function () {
              const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
              const diff = mocPrevACBalance.sub(mocActualACBalance);
              assertPrec("5.866666666666666666", diff);
            });
            it("THEN Moc Turbo TP balance increase for each TP", async function () {
              const mocTurboActualTPsBalance = await Promise.all(
                [TP_0, TP_1, TP_2].map(i => mocFunctions.tpBalanceOf(i, mocTurboAddress)),
              );
              [11750, "26.249999999999999997", 1168.225].forEach((increment, i) => {
                const diff = mocTurboActualTPsBalance[i].sub(mocTurboPrevTPsBalance[i]);
                assertPrec(increment, diff, `TP index ${i}`);
              });
            });
            it("THEN Moc Fee Flow AC balance increase 5.86 AC, 10% of ACtoMint", async function () {
              const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
              const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
              assertPrec("5.866666666666666666", diff);
            });
          });
        });
      });
    });
  });
};

export { successFeeBehavior };
