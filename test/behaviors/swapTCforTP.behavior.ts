import hre, { getNamedAccounts, ethers } from "hardhat";
import { ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { assertPrec } from "../helpers/assertHelper";
import { Balance, CONSTANTS, ERRORS, expectEventFor, pEth } from "../helpers/utils";
import { getNetworkDeployParams } from "../../scripts/utils";
import { MocCACoinbase, MocCARC20, MocRC20 } from "../../typechain";

const swapTCforTPBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let feeToken: MocRC20;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  let operator: Address;
  let vendor: Address;
  let expectEvent: any;
  const noVendor = CONSTANTS.ZERO_ADDRESS;
  const TP_0 = 0;

  const { mocFeeFlowAddress } = getNetworkDeployParams(hre).mocAddresses;

  let tx: ContractTransaction;
  let alicePrevTCBalance: Balance;
  let alicePrevACBalance: Balance;
  let mocPrevACBalance: Balance;
  let mocFeeFlowPrevACBalance: Balance;

  describe("Feature: swap Collateral Token for Pegged Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ mocImpl, feeToken } = mocContracts);
      ({ deployer, alice, bob, vendor } = await getNamedAccounts());
      operator = mocContracts.mocWrapper?.address || alice;
      expectEvent = expectEventFor(mocImpl, mocFunctions, "TCSwappedForTP");
    });

    describe("GIVEN alice has 3000 TC", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 3000 });
      });

      describe("WHEN alice tries to swap 0 TC", function () {
        it("THEN tx reverts because the amount of TC is too low and out of precision", async function () {
          await expect(mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 0 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO,
          );
        });
      });
      describe("WHEN alice swap 100 TC sending 0.99(less amount) AC for fees", function () {
        it("THEN tx reverts because AC received is below the minimum required", async function () {
          await expect(
            mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 100, qACmax: "0.999999999999999999" }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.INSUFFICIENT_QAC_SENT);
        });
      });
      describe("WHEN alice swap 100 TC expecting to receive 23501 TP as minimum", function () {
        /*
        100 TC = 100 AC
        100 AC = 23500 TP 0
        */
        it("THEN tx reverts because TP received is below the minimum required", async function () {
          await expect(
            mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 100, qTPmin: 23501 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.QTP_BELOW_MINIMUM);
        });
      });
      describe("WHEN alice tries to swap 722 TC", function () {
        /*
        722 TC = 722 AC
        100 AC = 169670 TP 0

        nAC = 3000    
        nTP = 0
        lckAC = 0
        ctargemaTP = 5.54
        ctargemaCA = 4
        => TP available to mint = 169632
        */
        it("THEN tx reverts because there is not enough TP to mint", async function () {
          await expect(mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 722 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.INSUFFICIENT_TP_TO_MINT,
          );
        });
      });
      describe("WHEN alice swaps 100 TC for 23500 TP 0", function () {
        /*
        100 TC = 100 AC
        100 AC = 23500 TP 0
            
        nAC = 3000  
        nTP = 23500
        lckAC = 100
        => coverage = 30

        swapTCforTPfee = 1%
        */
        beforeEach(async function () {
          [alicePrevTCBalance, alicePrevACBalance, mocPrevACBalance, mocFeeFlowPrevACBalance] = await Promise.all([
            mocFunctions.tcBalanceOf(alice),
            mocFunctions.assetBalanceOf(alice),
            mocFunctions.acBalanceOf(mocImpl.address),
            mocFunctions.acBalanceOf(mocFeeFlowAddress),
          ]);
          tx = await mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 100, qTPmin: 23500 });
        });
        it("THEN coverage decrease to 30 value", async function () {
          assertPrec(30, await mocImpl.getCglb());
        });
        it("THEN alice TP 0 balance is 23500", async function () {
          assertPrec(23500, await mocFunctions.tpBalanceOf(TP_0, alice));
        });
        it("THEN alice TC balance decrease 100", async function () {
          const aliceActualTCBalance = await mocFunctions.tcBalanceOf(alice);
          const diff = alicePrevTCBalance.sub(aliceActualTCBalance);
          assertPrec(100, diff);
        });
        it("THEN Moc balance didn't change", async function () {
          assertPrec(mocPrevACBalance, await mocFunctions.acBalanceOf(mocImpl.address));
        });
        it("THEN Moc Fee Flow balance increase 1% of 100 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(100 * 0.01, diff);
        });
        it("THEN alice balance decrease 1% for Moc Fee Flow of 100 AC", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec(1, diff);
        });
        it("THEN a TCSwappedForTP event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: alice
          // qTC: 100 TC
          // qTP: 23500 TP
          // qACfee: 1% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [TP_0, operator, alice, pEth(100), pEth(23500), pEth(100 * 0.01), 0, 0, 0, noVendor]);
        });
        it("THEN a Collateral Token Transfer event is emitted", async function () {
          // from: alice || mocWrapper
          // to: Zero Address
          // amount: 100 TC
          await expect(tx)
            .to.emit(mocContracts.mocCollateralToken, "Transfer")
            .withArgs(operator, CONSTANTS.ZERO_ADDRESS, pEth(100));
        });
        it("THEN a Pegged Token 0 Transfer event is emitted", async function () {
          // from: Zero Address
          // to: alice
          // amount: 23500 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[TP_0], "Transfer")
            .withArgs(CONSTANTS.ZERO_ADDRESS, alice, pEth(23500));
        });
      });
      describe("WHEN alice swaps 100 TC for 23500 TP 0 to bob", function () {
        /*
        100 TC = 100 AC
        100 AC = 23500 TP 0
            
        nAC = 3000  
        nTP = 23500
        lckAC = 100
        => coverage = 30

        swapTCforTPfee = 1%
        */
        beforeEach(async function () {
          [alicePrevTCBalance, alicePrevACBalance] = await Promise.all([
            mocFunctions.tcBalanceOf(alice),
            mocFunctions.assetBalanceOf(alice),
          ]);
          tx = await mocFunctions.swapTCforTPto({ i: TP_0, from: alice, to: bob, qTC: 100 });
        });
        it("THEN bob TP 0 balance is 23500", async function () {
          assertPrec(23500, await mocFunctions.tpBalanceOf(TP_0, bob));
        });
        it("THEN alice TC balance decrease 100", async function () {
          const aliceActualTCBalance = await mocFunctions.tcBalanceOf(alice);
          const diff = alicePrevTCBalance.sub(aliceActualTCBalance);
          assertPrec(100, diff);
        });
        it("THEN alice balance decrease 1% for Moc Fee Flow of 100 AC", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec(1, diff);
        });
        it("THEN a TCSwappedForTP event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: bob
          // qTC: 100 TC
          // qTP: 23500 TP
          // qACfee: 1% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [TP_0, operator, bob, pEth(100), pEth(23500), pEth(100 * 0.01), 0, 0, 0, noVendor]);
        });
      });
      describe("WHEN alice tries to swap 100 TC for 23500 TP 0 via vendor without sending the AC for the markup", function () {
        it("THEN tx reverts because AC received is below the minimum required", async function () {
          // qACmax = 1% for qACfee of 100AC
          await expect(
            mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 100, qACmax: 1, vendor }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.INSUFFICIENT_QAC_SENT);
        });
      });
      describe("WHEN alice swaps 100 TC for 23500 TP 0 via vendor", function () {
        let alicePrevACBalance: Balance;
        let vendorPrevACBalance: Balance;
        let tx: ContractTransaction;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          vendorPrevACBalance = await mocFunctions.acBalanceOf(vendor);
          tx = await mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 100, vendor });
        });
        it("THEN alice AC balance decrease 11 Asset (1% qACFee + 10% qACVendorMarkup of 100 qAC)", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec(11, diff);
        });
        it("THEN vendor AC balance increase 10 Asset", async function () {
          const vendorActualACBalance = await mocFunctions.acBalanceOf(vendor);
          const diff = vendorActualACBalance.sub(vendorPrevACBalance);
          assertPrec(10, diff);
        });
        it("THEN a TCSwappedForTP event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: alice
          // qTC: 100 TC
          // qTP: 23500 TP
          // qACfee: 1% AC
          // qFeeToken: 0
          // qACVendorMarkup: 10% AC
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [TP_0, operator, alice, pEth(100), pEth(23500), pEth(1), 0, pEth(10), 0, vendor]);
        });
      });
      describe("WHEN alice swaps 100 TC for 23500 TP 0 to bob via vendor", function () {
        let tx: ContractTransaction;
        beforeEach(async function () {
          tx = await mocFunctions.swapTCforTPto({ i: TP_0, from: alice, to: bob, qTC: 100, vendor });
        });
        it("THEN a TCSwappedForTP event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: bob
          // qTC: 100 TC
          // qTP: 23500 TP
          // qACfee: 1% AC
          // qFeeToken: 0
          // qACVendorMarkup: 10% AC
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [TP_0, operator, bob, pEth(100), pEth(23500), pEth(1), 0, pEth(10), 0, vendor]);
        });
      });
      describe("AND there are 100000 TC more in the protocol", function () {
        beforeEach(async function () {
          await mocFunctions.mintTC({ from: deployer, qTC: 100000 });
        });
        describe("WHEN alice tries to swap 3000.1 TC", function () {
          it("THEN tx reverts because alice doesn't have that much TC", async function () {
            // generic revert because in collateral bag implementation fails before trying to transfer the tokens
            await expect(mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: "3000.000000000000000001" })).to.be
              .reverted;
          });
        });
        describe("WHEN alice swaps 3000(all balance) TC for 705000 TP 0", function () {
          /*
            3000 TC = 3000 AC
            3000 AC = 705000 TP 0
            */
          beforeEach(async function () {
            tx = await mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 3000 });
          });
          it("THEN a TCSwappedForTP event is emitted", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: alice
            // qTC: 3000 TC
            // qTP: 705000 TP
            // qACfee: 1% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [TP_0, operator, alice, pEth(3000), pEth(705000), pEth(30), 0, 0, 0, noVendor]);
          });
        });
      });
      describe("AND 23500 TP0 are minted", function () {
        beforeEach(async function () {
          await mocFunctions.mintTP({ i: TP_0, from: deployer, qTP: 23500 });
        });
        describe("AND TP 0 has been devaluated to 470 making TC price rices", function () {
          /*  
            nAC = 3100    
            nTP = 23500 + 11750
            lckAC = 50 + 25
            nACgain = 5
            => pTCac = 1.0066
            */
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, 470);
          });
          describe("WHEN alice swaps 10 TC for 4731.02 TP 0", function () {
            /*
            10 TC = 10.066 AC
            10.066AC = 4731.33 TP 0
            */
            beforeEach(async function () {
              tx = await mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 10 });
            });
            it("THEN a TCSwappedForTP event is emitted", async function () {
              // i: 0
              // sender: alice || mocWrapper
              // receiver: alice
              // qTC: 10 TC
              // qTP: 4731.02 TP
              // qACfee: 1% AC
              // qFeeToken: 0
              // qACVendorMarkup: 0
              // qFeeTokenVendorMarkup: 0
              await expectEvent(tx, [
                TP_0,
                operator,
                alice,
                pEth(10),
                pEth("4731.333333333333333333"),
                pEth("0.100666666666666666"),
                0,
                0,
                0,
                noVendor,
              ]);
            });
          });
        });
        describe("AND TP 0 has been revaluated to 37.9", function () {
          /*  
            nAC = 3100    
            nTP = 23500
            lckAC = 620
            => coverage = 5 
        */
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, "37.9");
          });
          describe("WHEN alice tries to swap 1 TC for TP", function () {
            it("THEN tx reverts because coverage is below the target coverage adjusted by the moving average", async function () {
              await expect(mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 1 })).to.be.revertedWithCustomError(
                mocImpl,
                ERRORS.LOW_COVERAGE,
              );
            });
          });
        });
        describe("AND TP 0 has been revaluated to 100 making TC price falls", function () {
          /*  
          nAC = 3100 
          nTP = 23500
          lckAC = 235
          => pTCac = 0.955
          */
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, 100);
          });
          describe("WHEN alice tries to swap 1 wei TC for TP", function () {
            it("THEN tx reverts because the amount of TC is too low and out of precision", async function () {
              await expect(
                mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 1, applyPrecision: false }),
              ).to.be.revertedWithCustomError(mocImpl, ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO);
            });
          });
          describe("WHEN alice swaps 10 TC for 955 TP 0", function () {
            /*
            10 TC = 0.955 AC
            0.955 AC = 955 TP 0
            */
            beforeEach(async function () {
              tx = await mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 10 });
            });
            it("THEN a TCSwappedForTP event is emitted", async function () {
              // i: 0
              // sender: alice || mocWrapper
              // receiver: alice
              // qTC: 10 TC
              // qTP: 955 TP
              // qACfee: 1% AC
              // qFeeToken: 0
              // qACVendorMarkup: 0
              // qFeeTokenVendorMarkup: 0
              const args = [TP_0, operator, alice, pEth(10), pEth(955), pEth("0.0955"), 0, 0, 0, noVendor];
              await expectEvent(tx, args);
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
            await expect(mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 100 })).to.be.revertedWithCustomError(
              mocImpl,
              ERRORS.LOW_COVERAGE,
            );
          });
        });
      });
      describe("AND alice has FeeToken to pay fees", function () {
        let alicePrevACBalance: Balance;
        let alicePrevFeeTokenBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        let mocFeeFlowPrevFeeTokenBalance: Balance;
        let tx: ContractTransaction;
        beforeEach(async function () {
          // mint FeeToken to alice
          await feeToken.mint(alice, pEth(50));
          // for collateral bag implementation approve must be set to Moc Wrapper contract
          const spender = mocContracts.mocWrapper?.address || mocImpl.address;
          await feeToken.connect(await ethers.getSigner(alice)).approve(spender, pEth(50));

          // initialize previous balances
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          alicePrevFeeTokenBalance = await feeToken.balanceOf(alice);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          mocFeeFlowPrevFeeTokenBalance = await feeToken.balanceOf(mocFeeFlowAddress);
        });
        describe("WHEN alice swaps 100 TC for 23500 TP 0", function () {
          beforeEach(async function () {
            tx = await mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 100 });
          });
          it("THEN alice AC balance doesn't change", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = alicePrevACBalance.sub(aliceActualACBalance);
            assertPrec(0, diff);
          });
          it("THEN alice Fee Token balance decrease 0.5 (100 * 1% * 50%)", async function () {
            const aliceActualFeeTokenBalance = await feeToken.balanceOf(alice);
            const diff = alicePrevFeeTokenBalance.sub(aliceActualFeeTokenBalance);
            assertPrec(0.5, diff);
          });
          it("THEN Moc Fee Flow AC balance doesn't change", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
            assertPrec(mocFeeFlowActualACBalance, mocFeeFlowPrevACBalance);
          });
          it("THEN Moc Fee Flow Fee Token balance increase 0.5 (100 * 1% * 50%)", async function () {
            const mocFeeFlowActualFeeTokenBalance = await feeToken.balanceOf(mocFeeFlowAddress);
            const diff = mocFeeFlowActualFeeTokenBalance.sub(mocFeeFlowPrevFeeTokenBalance);
            assertPrec(0.5, diff);
          });
          it("THEN Fee Token is used as fee payment method", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: alice
            // qTC: 100 TC
            // qTP: 23500 TP
            // qACfee: 0
            // qFeeToken: 100 (1% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [TP_0, operator, alice, pEth(100), pEth(23500), 0, pEth(0.5), 0, 0, noVendor]);
          });
        });
        describe("WHEN alice swaps 100 TC for 23500 TP 0", function () {
          beforeEach(async function () {
            tx = await mocFunctions.swapTCforTPto({ i: TP_0, from: alice, to: bob, qTC: 100 });
          });
          it("THEN alice AC balance doesn't change", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = alicePrevACBalance.sub(aliceActualACBalance);
            assertPrec(0, diff);
          });
          it("THEN alice Fee Token balance decrease 0.5 (100 * 1% * 50%)", async function () {
            const aliceActualFeeTokenBalance = await feeToken.balanceOf(alice);
            const diff = alicePrevFeeTokenBalance.sub(aliceActualFeeTokenBalance);
            assertPrec(0.5, diff);
          });
          it("THEN Moc Fee Flow AC balance doesn't change", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
            assertPrec(mocFeeFlowActualACBalance, mocFeeFlowPrevACBalance);
          });
          it("THEN Moc Fee Flow Fee Token balance increase 0.5 (100 * 1% * 50%)", async function () {
            const mocFeeFlowActualFeeTokenBalance = await feeToken.balanceOf(mocFeeFlowAddress);
            const diff = mocFeeFlowActualFeeTokenBalance.sub(mocFeeFlowPrevFeeTokenBalance);
            assertPrec(0.5, diff);
          });
          it("THEN Fee Token is used as fee payment method", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: bob
            // qTC: 100 TC
            // qTP: 23500 TP
            // qACfee: 0
            // qFeeToken: 100 (1% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [TP_0, operator, bob, pEth(100), pEth(23500), 0, pEth(0.5), 0, 0, noVendor]);
          });
        });
      });
    });
  });
};

export { swapTCforTPBehavior };
