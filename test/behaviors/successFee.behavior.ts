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
  let mocPrevACBalance: Balance;
  let mocFeeFlowPrevACBalance: Balance;
  let mocTurboPrevTPsBalance: Balance[];
  let initializeBeforeBalances: () => Promise<void>;

  describe("Feature: success fee distribution", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ alice } = await getNamedAccounts());
      initializeBeforeBalances = async function () {
        [mocPrevACBalance, mocFeeFlowPrevACBalance, ...mocTurboPrevTPsBalance] = await Promise.all([
          mocFunctions.acBalanceOf(mocContracts.mocImpl.address),
          mocFunctions.acBalanceOf(mocFeeFlowAddress),
          ...[TP_0, TP_1, TP_2].map(i => mocFunctions.tpBalanceOf(i, mocTurboAddress)),
        ]);
      };
    });
    describe("GIVEN alice has open positions", function () {
      /*
      nAC = 1000 + 100 + 20 + 10
      lckAC = 130
      */
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 1000 });
        await Promise.all([23500, 105, 9345.8].map((qTP, i) => mocFunctions.mintTP({ i, from: alice, qTP })));
      });
      describe("WHEN an unauthorized account executes the settlement function in Moc Core", function () {
        it("THEN fails because only settlement contract can execute it", async function () {
          await expect(mocContracts.mocImpl.execSettlement()).to.be.revertedWithCustomError(
            mocContracts.mocImpl,
            ERRORS.ONLY_SETTLEMENT,
          );
        });
      });
      describe("AND settlement is executed without TP price variations", function () {
        beforeEach(async function () {
          await initializeBeforeBalances();
          nextBlockSettlement = await mocContracts.mocSettlement.bns();
          await mineUpTo(nextBlockSettlement);
          await mocContracts.mocSettlement.execSettlement();
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
      });
      describe("AND TPs prices have changed +100%, +50% and -25% respectively", function () {
        /*
        nAC = 1000 + 100 + 20 + 10
        nTP0 = 23500 + 11750 = 35250
        nTP1 = 105 + 26.25 = 131.5
        nTP2 = 9345.8 + 0 = 9345.8
        lckAC = 75 + 16.69 + 13.33
        nACgain = (50 + 6.66 + 0) * 0.1 = 5.66
        pTCac = 1130 - 105.02 - 5.66 / 1000 = 1.019
        coverage = 1130 - 5.66 / 105.02 = 10.707
        */
        beforeEach(async function () {
          await Promise.all([470, 7.875, 700.935].map((price, i) => mocFunctions.pokePrice(i, price)));
        });
        describe("WHEN ask for the TC price", function () {
          it("THEN it is 1.019", async function () {
            assertPrec("1.019333333333333333", await mocContracts.mocImpl.getPTCac());
          });
        });
        describe("WHEN ask for the coverage", function () {
          it("THEN it is 10.707", async function () {
            assertPrec("10.707936507936507936", await mocContracts.mocImpl.getCglb());
          });
        });
        describe("AND settlement is executed having one TP price variations", function () {
          /*
          nAC = 1130 - 5.66
          lckAC = 75 + 16.69 + 13.33
          nACgain = 0
          pTCac = 1124.34 - 105.02 - 0 / 1000 = 1.023
          TP1 minted to Turbo = 11750
          TP2 Minted to Turbo = 26.25
          TP3 Minted to Turbo = 0 => remains iuo = -3.33
          */
          beforeEach(async function () {
            nextBlockSettlement = await mocContracts.mocSettlement.bns();
            await mineUpTo(nextBlockSettlement);
            await mocContracts.mocSettlement.execSettlement();
          });
          describe("WHEN ask for the TC price", function () {
            it("THEN it didn´t change, it is 1.019", async function () {
              assertPrec("1.019333333333333333", await mocContracts.mocImpl.getPTCac());
            });
          });
          describe("WHEN ask for the coverage", function () {
            it("THEN it didn`t change, it is 10.707", async function () {
              assertPrec("10.707936507936507936", await mocContracts.mocImpl.getCglb());
            });
          });
          it("THEN Moc balance AC decrease 5.66 AC, 10% of mocGain", async function () {
            const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
            const diff = mocPrevACBalance.sub(mocActualACBalance);
            assertPrec("5.666666666666666666", diff);
          });
          it("THEN Moc Turbo TP balance increase 50% for each TP devaluation", async function () {
            const mocTurboActualTPsBalance = await Promise.all(
              [TP_0, TP_1, TP_2].map(i => mocFunctions.tpBalanceOf(i, mocTurboAddress)),
            );
            [11750, "26.250000000000000001", 0].forEach((increment, i) => {
              const diff = mocTurboActualTPsBalance[i].sub(mocTurboPrevTPsBalance[i]);
              assertPrec(increment, diff, `TP index ${i}`);
            });
          });
          it("THEN Moc Fee Flow AC balance increase 5.66 AC, 10% of mocGain", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
            const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
            assertPrec("5.666666666666666666", diff);
          });
          describe("AND TPs prices have changed again +50%, -50% and +100% respectively", function () {
            /*
            nAC = 1124.34
            nTP0 = 35250 + 8812.5 = 44062.5
            nTP1 = 131.5 + 0 = 131.5
            nTP2 = 9345.8 + 2336.45 = 11682.25
            lckAC = 62.5 + 33.39 + 8.29
            nACgain = (25 + 0 + (-3.33 + 6.66)) * 0.1 = 2.83
            pTCac = 1124.34 - 104.18 - 2.83 / 1000 = 1.0173
            */
            beforeEach(async function () {
              await Promise.all([705, "3.9375", 1401.87].map((price, i) => mocFunctions.pokePrice(i, price)));
            });
            describe("WHEN ask for the TC price", function () {
              it("THEN it is 1.0173", async function () {
                assertPrec("1.017333333333333333", await mocContracts.mocImpl.getPTCac());
              });
            });
          });
        });
        describe("AND TPs prices have changed again +50%, -50% and +100% respectively", function () {
          /*
          nAC = 1130
          nTP0 = 23500 + 23500 = 47000
          nTP1 = 105 + 0 = 105
          nTP2 = 9345.8 + 2336.45 = 11682.25
          lckAC = 66.66 + 26.66 + 8.29
          nACgain = (6.66 + 0 + 3.33) * 0.1 = 7
          pTCac = 1130 - 101.66 - 7 / 1000 = 1.0213
          coverage = 1130 - 7 / 101.66 = 11.04
          */
          beforeEach(async function () {
            await Promise.all([705, "3.9375", 1401.87].map((price, i) => mocFunctions.pokePrice(i, price)));
          });
          describe("WHEN ask for the TC price", function () {
            it("THEN it is 1.0213", async function () {
              assertPrec("1.021333333333333333", await mocContracts.mocImpl.getPTCac());
            });
          });
          describe("WHEN ask for the coverage", function () {
            it("THEN it is 11.04", async function () {
              assertPrec("11.045901639344262295", await mocContracts.mocImpl.getCglb());
            });
          });
          describe("AND settlement is executed having two TP price variations", function () {
            /*
            nAC = 1130 - 7
            lckAC = 66.66 + 26.66 + 8.29            
            nACgain = 0
            pTCac = 1123 - 101.66 - 0 / 1000 = 1.023
            TP1 minted to Turbo = 23500
            TP2 Minted to Turbo = 0 => remains iuo = -6.666
            TP3 Minted to Turbo = 2336.45
            */
            beforeEach(async function () {
              nextBlockSettlement = await mocContracts.mocSettlement.bns();
              await mineUpTo(nextBlockSettlement);
              await mocContracts.mocSettlement.execSettlement();
            });
            describe("WHEN ask for the TC price", function () {
              it("THEN it didn´t change, it is 1.0213", async function () {
                assertPrec("1.021333333333333333", await mocContracts.mocImpl.getPTCac());
              });
            });
            describe("WHEN ask for the coverage", function () {
              it("THEN it didn´t change, it is 11.04", async function () {
                assertPrec("11.045901639344262295", await mocContracts.mocImpl.getCglb());
              });
            });
            it("THEN Moc balance AC decrease 7 AC, 10% of mocGain", async function () {
              const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
              const diff = mocPrevACBalance.sub(mocActualACBalance);
              assertPrec(7, diff);
            });
            it("THEN Moc Turbo TP balance increase 50% for each TP devaluation", async function () {
              const mocTurboActualTPsBalance = await Promise.all(
                [TP_0, TP_1, TP_2].map(i => mocFunctions.tpBalanceOf(i, mocTurboAddress)),
              );
              ["23500.000000000000000117", 0, "2336.450000000000000467"].forEach((increment, i) => {
                const diff = mocTurboActualTPsBalance[i].sub(mocTurboPrevTPsBalance[i]);
                assertPrec(increment, diff, `TP index ${i}`);
              });
            });
            it("THEN Moc Fee Flow AC balance increase 7 AC, 10% of mocGain", async function () {
              const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
              const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
              assertPrec(7, diff);
            });
          });
        });
      });
    });
  });
};

export { successFeeBehavior };
