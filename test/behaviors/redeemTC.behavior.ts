import hre, { getNamedAccounts, ethers } from "hardhat";
import { ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { assertPrec } from "../helpers/assertHelper";
import { Balance, CONSTANTS, ERRORS, mineUpTo, pEth } from "../helpers/utils";
import { getNetworkDeployParams } from "../../scripts/utils";
import { MocCACoinbase, MocCARC20 } from "../../typechain";

const redeemTCBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let alice: Address;
  let bob: Address;
  let operator: Address;
  let vendor: Address;
  const noVendor = CONSTANTS.ZERO_ADDRESS;
  const TP_0 = 0;
  const TP_1 = 1;
  const { mocFeeFlowAddress } = getNetworkDeployParams(hre).mocAddresses;

  const expectEvent = async (tx: ContractTransaction, rawArgs: any[]) => {
    let args = rawArgs;
    if (mocFunctions.getEventArgs) {
      args = mocFunctions.getEventArgs(args);
    }
    await expect(tx)
      .to.emit(mocImpl, "TCRedeemed")
      .withArgs(...args);
  };

  describe("Feature: redeem Collateral Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ mocImpl } = mocContracts);
      ({ alice, bob, vendor } = await getNamedAccounts());
      operator = mocContracts.mocWrapper?.address || alice;
    });
    describe("GIVEN alice has 300 TC", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 300 });
      });
      describe("WHEN alice tries to redeem 0 TC", function () {
        it("THEN tx reverts because the amount of TC is too low and out of precision", async function () {
          await expect(mocFunctions.redeemTC({ from: alice, qTC: 0 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO,
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
            mocImpl,
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
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          tx = await mocFunctions.redeemTC({ from: alice, qTC: 300 });
        });
        it("THEN alice has 0 TC", async function () {
          assertPrec(0, await mocFunctions.tcBalanceOf(alice));
        });
        it("THEN Moc balance decrease 300 AC", async function () {
          assertPrec(0, await mocFunctions.acBalanceOf(mocImpl.address));
        });
        it("THEN Moc Fee Flow balance increase 5% of 300 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
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
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          const args = [operator, operator, pEth(300), pEth(300 * 0.95), pEth(300 * 0.05), 0, 0, 0, noVendor];
          await expectEvent(tx, args);
        });
        it("THEN a Collateral Token Transfer event is emitted", async function () {
          // from: alice || mocWrapper
          // to: Zero Address
          // amount: 300 TC
          await expect(tx)
            .to.emit(mocContracts.mocCollateralToken, "Transfer")
            .withArgs(operator, CONSTANTS.ZERO_ADDRESS, pEth(300));
        });
      });
      describe("WHEN alice redeems 300 TC to bob", function () {
        let tx: ContractTransaction;
        let bobPrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        beforeEach(async function () {
          bobPrevACBalance = await mocFunctions.assetBalanceOf(bob);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          tx = await mocFunctions.redeemTCto({ from: alice, to: bob, qTC: 300 });
        });
        it("THEN alice has 0 TC", async function () {
          assertPrec(0, await mocFunctions.tcBalanceOf(alice));
        });
        it("THEN Moc balance decrease 300 AC", async function () {
          assertPrec(0, await mocFunctions.acBalanceOf(mocImpl.address));
        });
        it("THEN Moc Fee Flow balance increase 5% of 300 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
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
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          const receiver = mocContracts.mocWrapper?.address || bob;
          const args = [operator, receiver, pEth(300), pEth(300 * 0.95), pEth(300 * 0.05), 0, 0, 0, noVendor];
          await expectEvent(tx, args);
        });
      });
      describe("WHEN alice redeems 100 TC via vendor", function () {
        let alicePrevACBalance: Balance;
        let vendorPrevACBalance: Balance;
        let tx: ContractTransaction;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          vendorPrevACBalance = await mocFunctions.acBalanceOf(vendor);
          tx = await mocFunctions.redeemTC({ from: alice, qTC: 100, vendor });
        });
        it("THEN alice AC balance increase 85 Asset (100 qAC - 5% qACFee - 10% qACVendorMarkup)", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = aliceActualACBalance.sub(alicePrevACBalance);
          assertPrec(85, diff);
        });
        it("THEN vendor AC balance increase 10 Asset", async function () {
          const vendorActualACBalance = await mocFunctions.acBalanceOf(vendor);
          const diff = vendorActualACBalance.sub(vendorPrevACBalance);
          assertPrec(10, diff);
        });
        it("THEN a TCRedeemed event is emitted", async function () {
          // sender: alice || mocWrapper
          // receiver: alice || mocWrapper
          // qTC: 100 TC
          // qAC: 100 AC - 5% for Moc Fee Flow - 10% for vendor
          // qACfee: 5% qAC
          // qFeeToken: 0
          // qACVendorMarkup: 10% qAC
          // qFeeTokenVendorMarkup: 10% qAC
          const args = [operator, operator, pEth(100), pEth(85), pEth(5), 0, pEth(10), 0, vendor];
          await expectEvent(tx, args);
        });
      });
      describe("WHEN alice redeems 100 TC to bob via vendor", function () {
        let tx: ContractTransaction;
        beforeEach(async function () {
          tx = await mocFunctions.redeemTCto({ from: alice, to: bob, qTC: 100, vendor });
        });
        it("THEN a TCRedeemed event is emitted", async function () {
          // sender: alice || mocWrapper
          // receiver: bob || mocWrapper
          // qTC: 100 TC
          // qAC: 100 AC - 5% for Moc Fee Flow - 10% for vendor
          // qACfee: 5% qAC
          // qFeeToken: 0
          // qACVendorMarkup: 10% qAC
          // qFeeTokenVendorMarkup: 10% qAC
          const receiver = mocContracts.mocWrapper?.address || bob;
          const args = [operator, receiver, pEth(100), pEth(85), pEth(5), 0, pEth(10), 0, vendor];
          await expectEvent(tx, args);
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
        describe("AND Pegged Token has been revaluated to 37.9", function () {
          /*  
            nAC = 310    
            nTP = 2350
            lckAC = 62
            => coverage = 5
        */
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, "37.9");
          });
          it("THEN the coverage is 5", async function () {
            assertPrec("4.999574468085106383", await mocImpl.getCglb());
          });
          it("THEN the are -0.0319 TC available to redeem", async function () {
            assertPrec("-0.031918289179699965", await mocImpl.getTCAvailableToRedeem());
          });
          describe("WHEN Alice tries to redeem 1 TC", function () {
            it("THEN tx reverts because coverage is below the target coverage adjusted by the moving average", async function () {
              await expect(mocFunctions.redeemTC({ from: alice, qTC: 1 })).to.be.revertedWithCustomError(
                mocImpl,
                ERRORS.LOW_COVERAGE,
              );
            });
          });
        });
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
                mocImpl,
                ERRORS.LOW_COVERAGE,
              );
            });
          });
        });
        it("THEN there are 254.58 TC available to redeem", async function () {
          assertPrec("254.585927183550273540", await mocImpl.getTCAvailableToRedeem());
        });
        describe("WHEN alice tries to redeem 254.59 TC", function () {
          it("THEN tx reverts because there is not enough TC available to redeem", async function () {
            await expect(
              mocFunctions.redeemTC({ from: alice, qTC: "254.585927183550273541" }),
            ).to.be.revertedWithCustomError(mocImpl, ERRORS.INSUFFICIENT_TC_TO_REDEEM);
          });
        });
        describe("WHEN alice redeems 254.58 TC", function () {
          let alicePrevTCBalance: Balance;
          let alicePrevACBalance: Balance;
          beforeEach(async function () {
            alicePrevTCBalance = await mocFunctions.tcBalanceOf(alice);
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            await mocFunctions.redeemTC({ from: alice, qTC: "254.585927183550273540" });
          });
          it("THEN there 0 TC available to redeem", async function () {
            assertPrec(0, await mocImpl.getTCAvailableToRedeem());
          });
          it("THEN alice balance decrease 254.58 TC", async function () {
            const aliceActualTCBalance = await mocFunctions.tcBalanceOf(alice);
            const diff = alicePrevTCBalance.sub(aliceActualTCBalance);
            assertPrec("254.585927183550273540", diff);
          });
          it("THEN alice balance increase 254.58 Asset - 5% for Moc Fee Flow", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = aliceActualACBalance.sub(alicePrevACBalance);
            assertPrec("241.856630824372759863", diff);
          });
          describe("AND bob mints 10 TC and 10 TP1, making TC available to redeem go to 3.968", function () {
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
            => TC available to redeem = 3.968
            */
            describe("WHEN alice tries to redeem 3.969 TC", function () {
              it("THEN tx reverts because there is not enough TC available to redeem", async function () {
                await expect(
                  mocFunctions.redeemTC({ from: alice, qTC: "3.968253968253968262" }),
                ).to.be.revertedWithCustomError(mocImpl, ERRORS.INSUFFICIENT_TC_TO_REDEEM);
              });
            });
            describe("WHEN alice redeems 3.968 TC", function () {
              let alicePrevTCBalance: Balance;
              let alicePrevACBalance: Balance;
              beforeEach(async function () {
                alicePrevTCBalance = await mocFunctions.tcBalanceOf(alice);
                alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
                await mocFunctions.redeemTC({ from: alice, qTC: "3.968253968253968261" });
              });
              it("THEN alice balance decrease 3.968 TC", async function () {
                const aliceActualTCBalance = await mocFunctions.tcBalanceOf(alice);
                const diff = alicePrevTCBalance.sub(aliceActualTCBalance);
                assertPrec("3.968253968253968261", diff);
              });
              it("THEN alice balance increase 3.968 Asset - 5% for Moc Fee Flow", async function () {
                const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
                const diff = aliceActualACBalance.sub(alicePrevACBalance);
                assertPrec("3.769841269841269848", diff);
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
              ).to.be.revertedWithCustomError(mocImpl, ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO);
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
            assertPrec("1.007066666666666666", await mocImpl.getPTCac());
          });
          it("THEN coverage is 42.104", async function () {
            assertPrec("42.104761904761904761", await mocImpl.getCglb());
          });
          it("THEN there are 221.24 TC available to redeem", async function () {
            assertPrec("221.248334070249917149", await mocImpl.getTCAvailableToRedeem());
          });
          describe("AND EMA is updated", function () {
            /*
            ctargemaCA = 11.04
            => TC available to redeem = 226.71
            */
            beforeEach(async function () {
              await mineUpTo(await mocImpl.nextEmaCalculation());
              await mocImpl.updateEmas();
            });
            it("THEN there are 226.71 TC available to redeem", async function () {
              assertPrec("226.719806179762611513", await mocImpl.getTCAvailableToRedeem());
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
              assertPrec("0.955", await mocImpl.getPTCac());
            });
            it("THEN the coverage is 13.19", async function () {
              assertPrec("13.191489361702127659", await mocImpl.getCglb());
            });
            it("THEN there are 201.57 TC available to redeem", async function () {
              assertPrec("201.570680628272251308", await mocImpl.getTCAvailableToRedeem());
            });
            describe("AND EMA is updated", function () {
              /*
              ctargemaCA = 5
              => TC available to redeem = 201.57
              */
              beforeEach(async function () {
                await mineUpTo(await mocImpl.nextEmaCalculation());
                await mocImpl.updateEmas();
              });
              it("THEN there are 201.57 TC available to redeem", async function () {
                assertPrec("201.570680628272251308", await mocImpl.getTCAvailableToRedeem());
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
        describe("AND Pegged Token has been revaluated making lckAC bigger than total AC in the protocol", function () {
          // this test is to check that tx doesn't fail because underflow doing totalACAvailable - lckAC
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, "0.00000001");
          });
          it("THEN tx reverts because coverage is below the protected threshold", async function () {
            expect((await mocImpl.getCglb()) < pEth(1)); // check that lckAC > totalACAvailable
            await expect(mocFunctions.redeemTC({ from: alice, qTC: 100 })).to.be.revertedWithCustomError(
              mocImpl,
              ERRORS.LOW_COVERAGE,
            );
          });
        });
      });
      describe("AND alice has FeeToken to pay fees", function () {
        let alicePrevFeeTokenBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        let mocFeeFlowPrevFeeTokenBalance: Balance;
        let tx: ContractTransaction;
        beforeEach(async function () {
          // mint FeeToken to alice
          await mocContracts.feeToken.mint(alice, pEth(50));
          // for collateral bag implementation approve must be set to Moc Wrapper contract
          const spender = mocContracts.mocWrapper?.address || mocImpl.address;
          await mocContracts.feeToken.connect(await ethers.getSigner(alice)).approve(spender, pEth(50));

          // initialize previous balances
          alicePrevFeeTokenBalance = await mocContracts.feeToken.balanceOf(alice);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          mocFeeFlowPrevFeeTokenBalance = await mocContracts.feeToken.balanceOf(mocFeeFlowAddress);
        });
        describe("WHEN alice redeems 100 TC", function () {
          let alicePrevACBalance: Balance;
          beforeEach(async function () {
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            tx = await mocFunctions.redeemTC({ from: alice, qTC: 100 });
          });
          it("THEN alice AC balance increase 100 Asset", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = aliceActualACBalance.sub(alicePrevACBalance);
            assertPrec(100, diff);
          });
          it("THEN alice Fee Token balance decrease 2.5 (100 * 5% * 50%)", async function () {
            const aliceActualFeeTokenBalance = await mocContracts.feeToken.balanceOf(alice);
            const diff = alicePrevFeeTokenBalance.sub(aliceActualFeeTokenBalance);
            assertPrec(2.5, diff);
          });
          it("THEN Moc Fee Flow AC balance doesn't change", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
            assertPrec(mocFeeFlowActualACBalance, mocFeeFlowPrevACBalance);
          });
          it("THEN Moc Fee Flow Fee Token balance increase 2.5 (100 * 5% * 50%)", async function () {
            const mocFeeFlowActualFeeTokenBalance = await mocContracts.feeToken.balanceOf(mocFeeFlowAddress);
            const diff = mocFeeFlowActualFeeTokenBalance.sub(mocFeeFlowPrevFeeTokenBalance);
            assertPrec(2.5, diff);
          });
          it("THEN Fee Token is used as fee payment method", async function () {
            // sender: alice || mocWrapper
            // receiver: alice || mocWrapper
            // qTC: 100 TC
            // qAC: 100 AC
            // qACfee: 0 AC
            // qFeeToken: 100 (5% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            const args = [operator, operator, pEth(100), pEth(100), 0, pEth(100 * 0.05 * 0.5), 0, 0, noVendor];
            await expectEvent(tx, args);
          });
        });
        describe("WHEN alice redeems 100 TC to bob", function () {
          let bobPrevACBalance: Balance;
          beforeEach(async function () {
            bobPrevACBalance = await mocFunctions.assetBalanceOf(bob);
            tx = await mocFunctions.redeemTCto({ from: alice, to: bob, qTC: 100 });
          });
          it("THEN bob AC balance increase 100 Asset", async function () {
            const bobActualACBalance = await mocFunctions.assetBalanceOf(bob);
            const diff = bobActualACBalance.sub(bobPrevACBalance);
            assertPrec(100, diff);
          });
          it("THEN alice Fee Token balance decrease 2.5 (100 * 5% * 50%)", async function () {
            const aliceActualFeeTokenBalance = await mocContracts.feeToken.balanceOf(alice);
            const diff = alicePrevFeeTokenBalance.sub(aliceActualFeeTokenBalance);
            assertPrec(2.5, diff);
          });
          it("THEN Moc Fee Flow AC balance doesn't change", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
            assertPrec(mocFeeFlowActualACBalance, mocFeeFlowPrevACBalance);
          });
          it("THEN Moc Fee Flow Fee Token balance increase 2.5 (100 * 5% * 50%)", async function () {
            const mocFeeFlowActualFeeTokenBalance = await mocContracts.feeToken.balanceOf(mocFeeFlowAddress);
            const diff = mocFeeFlowActualFeeTokenBalance.sub(mocFeeFlowPrevFeeTokenBalance);
            assertPrec(2.5, diff);
          });
          it("THEN Fee Token is used as fee payment method", async function () {
            // sender: alice || mocWrapper
            // receiver: bob || mocWrapper
            // qTC: 100 TC
            // qAC: 100 AC
            // qACfee: 0 AC
            // qFeeToken: 100 (5% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            const receiver = mocContracts.mocWrapper?.address || bob;
            const args = [operator, receiver, pEth(100), pEth(100), 0, pEth(100 * 0.05 * 0.5), 0, 0, noVendor];
            await expectEvent(tx, args);
          });
        });
      });
    });
  });
};

export { redeemTCBehavior };
