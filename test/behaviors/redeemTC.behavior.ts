import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { Balance, ERRORS, pEth, CONSTANTS, mineUpTo } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";
import { expect } from "chai";

const redeemTCBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;
  const TP_1 = 1;
  const mocFeeFlow = mocAddresses["hardhat"].mocFeeFlowAddress;

  describe("Feature: redeem Collateral Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ alice, bob } = await getNamedAccounts());
    });
    describe("GIVEN alice has 300 TC", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 300 });
      });
      describe("WHEN alice tries to redeem 0 TC", function () {
        it("THEN tx reverts because the amount of TC is invalid", async function () {
          await expect(mocFunctions.redeemTC({ from: alice, qTC: 0 })).to.be.revertedWithCustomError(
            mocContracts.mocImpl,
            ERRORS.INVALID_VALUE,
          );
        });
      });
      describe("WHEN alice tries to redeem 300 TC to the zero address", function () {
        it("THEN tx reverts because recipient is the zero address", async function () {
          await expect(mocFunctions.redeemTCto({ from: alice, to: CONSTANTS.ZERO_ADDRESS, qTC: 300 })).to.be.reverted;
        });
      });
      describe("WHEN alice tries to redeem 301 TC", function () {
        it("THEN tx reverts because there is not enough TC available to redeem", async function () {
          await expect(mocFunctions.redeemTC({ from: alice, qTC: 301 })).to.be.reverted;
        });
      });
      describe("AND alice transfers 50 TC to bob", function () {
        beforeEach(async function () {
          await mocFunctions.tcTransfer({ from: alice, to: bob, amount: 50 });
        });
        describe("WHEN alice tries to redeem 251 TC", function () {
          it("THEN tx reverts because alice doesn't have that much TC", async function () {
            await expect(mocFunctions.redeemTC({ from: alice, qTC: 251 })).to.be.reverted;
          });
        });
      });
      describe("WHEN alice redeems 300 TC expecting 301 Asset", function () {
        it("THEN tx reverts because Asset received is below the minimum required", async function () {
          await expect(mocFunctions.redeemTC({ from: alice, qTC: 300, qACmin: 301 })).to.be.revertedWithCustomError(
            mocContracts.mocImpl,
            ERRORS.QAC_BELOW_MINIMUM,
          );
        });
      });
      describe("WHEN alice redeems 300 TC", function () {
        /*  
        nAC = 300    
        nTP = 0
        lckAC = 0
        ctarg = 4
        => TC available to redeem = 300
        */
        let tx: ContractTransaction;
        let alicePrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          tx = await mocFunctions.redeemTC({ from: alice, qTC: 300 });
        });
        it("THEN alice has 0 TC", async function () {
          assertPrec(0, await mocFunctions.tcBalanceOf(alice));
        });
        it("THEN Moc balance decrease 300 AC", async function () {
          assertPrec(0, await mocFunctions.acBalanceOf(mocContracts.mocImpl.address));
        });
        it("THEN Moc Fee Flow balance increase 5% of 300 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(300 * 0.05, diff);
        });
        it("THEN alice balance increase 300 Asset - 5% for Moc Fee Flow", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = aliceActualACBalance.sub(alicePrevACBalance);
          assertPrec(300 * 0.95, diff);
        });
        it("THEN a TCRedeemed event is emitted", async function () {
          // sender: alice || mocWrapper
          // receiver: alice || mocWrapper
          // qTC: 300 TC
          // qAC: 300 AC - 5% for Moc Fee Flow
          // qACfee: 5% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TCRedeemed")
            .withArgs(
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || alice,
              pEth(300),
              pEth(300 * 0.95),
              pEth(300 * 0.05),
            );
        });
        it("THEN a Collateral Token Transfer event is emitted", async function () {
          // from: alice || mocWrapper
          // to: Zero Address
          // amount: 300 TC
          await expect(tx)
            .to.emit(mocContracts.mocCollateralToken, "Transfer")
            .withArgs(mocContracts.mocWrapper?.address || alice, CONSTANTS.ZERO_ADDRESS, pEth(300));
        });
      });
      describe("WHEN alice redeems 300 TC to bob", function () {
        let tx: ContractTransaction;
        let bobPrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        beforeEach(async function () {
          bobPrevACBalance = await mocFunctions.assetBalanceOf(bob);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          tx = await mocFunctions.redeemTCto({ from: alice, to: bob, qTC: 300 });
        });
        it("THEN alice has 0 TC", async function () {
          assertPrec(0, await mocFunctions.tcBalanceOf(alice));
        });
        it("THEN Moc balance decrease 300 AC", async function () {
          assertPrec(0, await mocFunctions.acBalanceOf(mocContracts.mocImpl.address));
        });
        it("THEN Moc Fee Flow balance increase 5% of 300 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(300 * 0.05, diff);
        });
        it("THEN bob balance increase 300 Asset - 5% for Moc Fee Flow", async function () {
          const bobActualACBalance = await mocFunctions.assetBalanceOf(bob);
          const diff = bobActualACBalance.sub(bobPrevACBalance);
          assertPrec(300 * 0.95, diff);
        });
        it("THEN a TCRedeemed event is emitted", async function () {
          // sender: alice || mocWrapper
          // receiver: bob || mocWrapper
          // qTC: 300 TC
          // qAC: 300 AC - 5% for Moc Fee Flow
          // qACfee: 5% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TCRedeemed")
            .withArgs(
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || bob,
              pEth(300),
              pEth(300 * 0.95),
              pEth(300 * 0.05),
            );
        });
      });
      describe("AND alice mints 2350 TP0, so there are 254.5859272 TC available to reedem", function () {
        beforeEach(async function () {
          await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 2350 });
        });
        /*  
        nAC = 310   
        nTP0 = 2350
        lckAC = 10
        ctarg = 5.54
        => TC available to redeem = 254.5859272
        */
        describe("AND Collateral Asset relation with Pegged Token price falls to 1/15.5", function () {
          beforeEach(async function () {
            await mocFunctions.pokePrice(0, "0.064516129032258064");
          });
          describe("WHEN Alice tries to redeem 100 TC", function () {
            /*  
              nAC = 310    
              nTP = 10
              lckAC = 155
              => coverage = 2 
          */
            it("THEN tx reverts because coverage is below the protected threshold", async function () {
              await expect(mocFunctions.redeemTC({ from: alice, qTC: 100 })).to.be.revertedWithCustomError(
                mocContracts.mocImpl,
                ERRORS.LOW_COVERAGE,
              );
            });
          });
        });
        describe("WHEN alice tries to redeem 254.59 TC", function () {
          it("THEN tx reverts because there is not enough TC available to redeem", async function () {
            await expect(mocFunctions.redeemTC({ from: alice, qTC: 254.59 })).to.be.revertedWithCustomError(
              mocContracts.mocImpl,
              ERRORS.INSUFFICIENT_TC_TO_REDEEM,
            );
          });
        });
        describe("WHEN alice redeems 254.58 TC", function () {
          let alicePrevACBalance: Balance;
          beforeEach(async function () {
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            await mocFunctions.redeemTC({ from: alice, qTC: 254.58 });
          });
          it("THEN alice balance decrease 254.58 TC", async function () {
            assertPrec(300 - 254.58, await mocFunctions.tcBalanceOf(alice));
          });
          it("THEN alice balance increase 254.58 Asset - 5% for Moc Fee Flow", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = aliceActualACBalance.sub(alicePrevACBalance);
            assertPrec(254.58 * 0.95, diff);
          });
          describe("AND bob mints 10 TC and 10 TP1, making TC available to redeem go to 3.974", function () {
            beforeEach(async function () {
              await mocFunctions.mintTC({ from: bob, qTC: 10 });
              await mocFunctions.mintTP({ i: TP_1, from: bob, qTP: 10 });
            });
            /*  
            nAC = 67.32
            nTP0 = 2350
            nTP1 = 10
            lckAC = 11.9
            ctarg = 5.32
            => TC available to redeem = 3.974
            */
            describe("WHEN alice tries to redeem 3.975 TC", function () {
              it("THEN tx reverts because there is not enough TC available to redeem", async function () {
                await expect(mocFunctions.redeemTC({ from: alice, qTC: 3.975 })).to.be.revertedWithCustomError(
                  mocContracts.mocImpl,
                  ERRORS.INSUFFICIENT_TC_TO_REDEEM,
                );
              });
            });
            describe("WHEN alice redeems 3.974 TC", function () {
              let alicePrevACBalance: Balance;
              beforeEach(async function () {
                alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
                await mocFunctions.redeemTC({ from: alice, qTC: 3.974 });
              });
              it("THEN alice balance decrease 3.974 TC", async function () {
                assertPrec(300 - 254.58 - 3.974, await mocFunctions.tcBalanceOf(alice));
              });
              it("THEN alice balance increase 3.974 Asset - 5% for Moc Fee Flow", async function () {
                const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
                const diff = aliceActualACBalance.sub(alicePrevACBalance);
                assertPrec("3.7753", diff);
              });
            });
          });
        });
        describe("AND Collateral Asset relation with Pegged Token price falls to 100 making TC price falls too", function () {
          /*  
          nAC = 310    
          nTP = 2350
          lckAC = 23.5
          => pTCac = 0.955
          */
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, 100);
          });
          describe("WHEN alice tries to redeem 1 wei TC", function () {
            it("THEN tx reverts because the amount of TC is too low and out of precision", async function () {
              await expect(
                mocFunctions.redeemTC({ from: alice, qTC: 1, applyPrecision: false }),
              ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO);
            });
          });
          describe("WHEN alice redeems 100 TC", function () {
            let alicePrevACBalance: Balance;
            beforeEach(async function () {
              alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
              await mocFunctions.redeemTC({ from: alice, qTC: 100 });
            });
            it("THEN alice receives 90.72 assets instead of 95", async function () {
              const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
              const diff = aliceActualACBalance.sub(alicePrevACBalance);
              assertPrec("90.725", diff);
            });
          });
        });
        describe("AND Pegged Token has been devaluated to 500 making TC price rices", function () {
          /*  
          nAC = 310    
          nTP = 2350 + 1325
          lckAC = 7.35
          nACgain = 0.53
          => pTCac = 1.00706
          => coverage = 42.104
          ctargemaCA = 11.79
          => TC available to redeem = 221.24
          */
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, 500);
          });
          it("THEN TC price is 1.00706", async function () {
            assertPrec("1.007066666666666666", await mocContracts.mocImpl.getPTCac());
          });
          it("THEN coverage is 42.104", async function () {
            assertPrec("42.104761904761904761", await mocContracts.mocImpl.getCglb());
          });
          it("THEN there are 221.24 TC available to redeem", async function () {
            assertPrec("221.248334070249917149", await mocContracts.mocImpl.getTCAvailableToRedeem());
          });
          describe("AND EMA is updated", function () {
            /*
            ctargemaCA = 11.04
            => TC available to redeem = 226.71
            */
            beforeEach(async function () {
              await mineUpTo(await mocContracts.mocImpl.nextEmaCalculation());
              await mocContracts.mocImpl.updateEmas();
            });
            it("THEN there are 226.71 TC available to redeem", async function () {
              assertPrec("226.719806179762611513", await mocContracts.mocImpl.getTCAvailableToRedeem());
            });
          });
          describe("WHEN alice redeems 100 TC", function () {
            let alicePrevACBalance: Balance;
            beforeEach(async function () {
              alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
              await mocFunctions.redeemTC({ from: alice, qTC: 100 });
            });
            it("THEN alice receives 95.67 assets instead of 95", async function () {
              const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
              const diff = aliceActualACBalance.sub(alicePrevACBalance);
              assertPrec("95.671333333333333270", diff);
            });
          });
          describe("AND Pegged Token has been revaluated to 100 making TC price falls", function () {
            /*  
            nAC = 310  
            nTP = 2350
            lckAC = 23.5
            nACgain = -8.1
            => pTCac = 0.955
            => coverage = 13.19
            ctargemaCA = 5
            => TC available to redeem = 201.57
            */
            beforeEach(async function () {
              await mocFunctions.pokePrice(TP_0, 100);
            });
            it("THEN TC price is 0.955", async function () {
              assertPrec("0.955", await mocContracts.mocImpl.getPTCac());
            });
            it("THEN the coverage is 13.19", async function () {
              assertPrec("13.191489361702127659", await mocContracts.mocImpl.getCglb());
            });
            it("THEN there are 201.57 TC available to redeem", async function () {
              assertPrec("201.570680628272251308", await mocContracts.mocImpl.getTCAvailableToRedeem());
            });
            describe("AND EMA is updated", function () {
              /*
              ctargemaCA = 5
              => TC available to redeem = 201.57
              */
              beforeEach(async function () {
                await mineUpTo(await mocContracts.mocImpl.nextEmaCalculation());
                await mocContracts.mocImpl.updateEmas();
              });
              it("THEN there are 201.57 TC available to redeem", async function () {
                assertPrec("201.570680628272251308", await mocContracts.mocImpl.getTCAvailableToRedeem());
              });
            });
            describe("WHEN alice redeems 100 TC", function () {
              let alicePrevACBalance: Balance;
              beforeEach(async function () {
                alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
                await mocFunctions.redeemTC({ from: alice, qTC: 100 });
              });
              it("THEN alice receives 90.725 assets instead of 95", async function () {
                const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
                const diff = aliceActualACBalance.sub(alicePrevACBalance);
                assertPrec("90.725", diff);
              });
            });
          });
        });
      });
    });
  });
};

export { redeemTCBehavior };
