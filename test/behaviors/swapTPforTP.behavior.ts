import hre, { getNamedAccounts, ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { assertPrec } from "../helpers/assertHelper";
import { Balance, CONSTANTS, ERRORS, pEth } from "../helpers/utils";
import { getNetworkDeployParams } from "../../scripts/utils";
import { MocCACoinbase, MocCARC20, MocRC20 } from "../../typechain";

const swapTPforTPBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let feeToken: MocRC20;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  let operator: Address;
  let vendor: Address;
  const TP_0 = 0;
  const TP_1 = 1;
  const TP_4 = 4;
  const TP_NON_EXISTENT = 5;

  const { mocFeeFlowAddress } = getNetworkDeployParams(hre).mocAddresses;

  let coverageBefore: BigNumber;
  let tx: ContractTransaction;
  let alicePrevTP0Balance: Balance;
  let alicePrevACBalance: Balance;
  let mocPrevACBalance: Balance;
  let mocFeeFlowPrevACBalance: Balance;

  describe("Feature: swap Pegged Token for another Pegged Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ mocImpl, feeToken } = mocContracts);
      ({ deployer, alice, bob, vendor } = await getNamedAccounts());
      operator = mocContracts.mocWrapper?.address || alice;
      // add collateral
      await mocFunctions.mintTC({ from: deployer, qTC: 3000 });
    });
    describe("GIVEN alice has 23500 TP 0", function () {
      beforeEach(async function () {
        await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500 });
      });
      describe("AND TP 0 price provider is deprecated", function () {
        beforeEach(async function () {
          await mocContracts.priceProviders[TP_0].deprecatePriceProvider();
        });
        describe("WHEN alice tries to swap TP 0 for TP 1", function () {
          it("THEN tx reverts because invalid price provider", async function () {
            await expect(
              mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23500 }),
            ).to.be.revertedWithCustomError(mocImpl, ERRORS.MISSING_PROVIDER_PRICE);
          });
        });
      });
      describe("AND TP 1 price provider is deprecated", function () {
        beforeEach(async function () {
          await mocContracts.priceProviders[TP_1].deprecatePriceProvider();
        });
        describe("WHEN alice tries to swap TP 0 for TP 1", function () {
          it("THEN tx reverts because invalid price provider", async function () {
            await expect(
              mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23500 }),
            ).to.be.revertedWithCustomError(mocImpl, ERRORS.MISSING_PROVIDER_PRICE);
          });
        });
      });
      describe("WHEN alice tries to swap TP 0 for TP 0", function () {
        it("THEN tx reverts because invalid value", async function () {
          await expect(
            mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_0, from: alice, qTP: 23500 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_VALUE);
        });
      });
      describe("WHEN alice tries to swap using a non-existent TP", function () {
        it("THEN tx reverts with panic code 0x32 array out of bounded", async function () {
          // generic revert because collateralbag implementation fail before accessing the tp array
          await expect(mocFunctions.swapTPforTP({ iFrom: TP_NON_EXISTENT, iTo: TP_0, from: alice, qTP: 23500 })).to.be
            .reverted;
        });
      });
      describe("WHEN alice tries to swap TP 0 for a non-existent TP", function () {
        it("THEN tx reverts with panic code 0x32 array out of bounded", async function () {
          await expect(
            mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_NON_EXISTENT, from: alice, qTP: 23500 }),
          ).to.be.revertedWithPanic("0x32");
        });
      });
      describe("WHEN alice tries to swap 0 TP 0", function () {
        it("THEN tx reverts because the amount of TP is too low and out of precision", async function () {
          await expect(
            mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 0 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.QTP_BELOW_MINIMUM);
        });
      });
      describe("WHEN alice tries to swap 1 TP 0 to the zero address", function () {
        it("THEN tx reverts because recipient is the zero address", async function () {
          await expect(
            mocFunctions.swapTPforTPto({ iFrom: TP_0, iTo: TP_1, from: alice, to: CONSTANTS.ZERO_ADDRESS, qTP: 23500 }),
          ).to.be.revertedWith("ERC20: mint to the zero address");
        });
      });
      describe("WHEN alice tries to swap 1 wei TP 0", function () {
        it("THEN tx reverts because the amount of TP is too low and out of precision", async function () {
          await expect(
            mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 1, applyPrecision: false }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.QTP_BELOW_MINIMUM);
        });
      });
      describe("AND TP 1 revalues to 0.9", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_1, 0.9);
        });
        describe("WHEN alice tries to swap 235 wei TP 0", function () {
          it("THEN tx reverts because the amount of TP is too low to swap for TP 1", async function () {
            await expect(
              mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 235, applyPrecision: false }),
            ).to.be.revertedWithCustomError(mocImpl, ERRORS.QTP_BELOW_MINIMUM);
          });
        });
      });
      describe("WHEN alice tries to swap 23501 TP 0", function () {
        it("THEN tx reverts because there is not enough TP available to redeem", async function () {
          // generic revert because collateralbag implementation fails trying to transfer the TP and
          // the others implementation fail burning
          await expect(mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23501 })).to.be.reverted;
        });
      });
      describe("WHEN alice swap 23500 TP 0 sending 0.99 Asset for fees", function () {
        it("THEN tx reverts because Asset received is below the minimum required", async function () {
          await expect(
            mocFunctions.swapTPforTP({
              iFrom: TP_0,
              iTo: TP_1,
              from: alice,
              qTP: 23500,
              qACmax: "0.999999999999999999",
            }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.INSUFFICIENT_QAC_SENT);
        });
      });
      describe("WHEN alice swap 23500 TP 0 expecting receive 526 TP 1 as minimum", function () {
        /*
            23500 TP 0 = 100 AC
            100 AC = 525 TP 1
          */
        it("THEN tx reverts because Asset received is below the minimum required", async function () {
          await expect(
            mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23500, qTPmin: 526 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.QTP_BELOW_MINIMUM);
        });
      });
      describe("WHEN alice swap 23500(all balance) TP 0 for 525 TP 1", function () {
        /*
            23500 TP 0 = 100 AC
            100 AC = 525 TP 1

            swapTPforTPfee = 1%
          */
        beforeEach(async function () {
          [coverageBefore, alicePrevACBalance, mocPrevACBalance, mocFeeFlowPrevACBalance] = await Promise.all([
            mocImpl.getCglb(),
            mocFunctions.assetBalanceOf(alice),
            mocFunctions.acBalanceOf(mocImpl.address),
            mocFunctions.acBalanceOf(mocFeeFlowAddress),
          ]);
          tx = await mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23500, qTPmin: 525 });
        });
        it("THEN coverage didn't change", async function () {
          assertPrec(coverageBefore, await mocImpl.getCglb());
        });
        it("THEN alice TP 0 balances is 0", async function () {
          assertPrec(0, await mocFunctions.tpBalanceOf(TP_0, alice));
        });
        it("THEN alice TP 1 balances is 525", async function () {
          assertPrec(525, await mocFunctions.tpBalanceOf(TP_1, alice));
        });
        it("THEN Moc balance didn't change", async function () {
          assertPrec(mocPrevACBalance, await mocFunctions.acBalanceOf(mocImpl.address));
        });
        it("THEN Moc Fee Flow balance increase 1% of 100 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(100 * 0.01, diff);
        });
        it("THEN alice balance decrease 1% for Moc Fee Flow of 100 Asset", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec(1, diff);
        });
        it("THEN a TPSwappedForTP event is emitted", async function () {
          // iFrom: 0
          // iTo: 1
          // sender: alice || mocWrapper
          // receiver: alice
          // qTPfrom: 23500 TP
          // qTPto: 525 TP
          // qACfee: 1% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expect(tx)
            .to.emit(mocImpl, "TPSwappedForTP")
            .withArgs(TP_0, TP_1, operator, alice, pEth(23500), pEth(525), pEth(100 * 0.01), 0, 0, 0);
        });
        it("THEN a Pegged Token 0 Transfer event is emitted", async function () {
          // from: alice || mocWrapper
          // to: Zero Address
          // amount: 23500 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[TP_0], "Transfer")
            .withArgs(operator, CONSTANTS.ZERO_ADDRESS, pEth(23500));
        });
        it("THEN a Pegged Token 1 Transfer event is emitted", async function () {
          // from: Zero Address
          // to: alice
          // amount: 525 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[TP_1], "Transfer")
            .withArgs(CONSTANTS.ZERO_ADDRESS, alice, pEth(525));
        });
      });
      describe("WHEN alice swap 2350(10% of balance) TP 0 for 52.5 TP 1 to bob", function () {
        /*
            2350 TP 0 = 10 AC
            10 AC = 52.5 TP 1

            swapTPforTPfee = 1%
          */
        beforeEach(async function () {
          coverageBefore = await mocImpl.getCglb();
          alicePrevTP0Balance = await mocFunctions.tpBalanceOf(TP_0, alice);
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocImpl.address);
          tx = await mocFunctions.swapTPforTPto({
            iFrom: TP_0,
            iTo: TP_1,
            from: alice,
            to: bob,
            qTP: 2350,
            qTPmin: 5.25,
          });
        });
        it("THEN coverage didn't change", async function () {
          assertPrec(coverageBefore, await mocImpl.getCglb());
        });
        it("THEN alice TP 0 balances decrease 2350 TP", async function () {
          const aliceActualTP0Balance = await mocFunctions.tpBalanceOf(TP_0, alice);
          const diff = alicePrevTP0Balance.sub(aliceActualTP0Balance);
          assertPrec(2350, diff);
        });
        it("THEN bob TP 1 balances is 52.5", async function () {
          assertPrec(52.5, await mocFunctions.tpBalanceOf(TP_1, bob));
        });
        it("THEN Moc balance didn't change", async function () {
          assertPrec(mocPrevACBalance, await mocFunctions.acBalanceOf(mocImpl.address));
        });
        it("THEN a TPSwappedForTP event is emitted", async function () {
          // iFrom: 0
          // iTo: 1
          // sender: alice || mocWrapper
          // receiver: bob
          // qTPfrom: 2350 TP
          // qTPto: 52.5 TP
          // qACfee: 1% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expect(tx)
            .to.emit(mocImpl, "TPSwappedForTP")
            .withArgs(TP_0, TP_1, operator, bob, pEth(2350), pEth(52.5), pEth(10 * 0.01), 0, 0, 0);
        });
      });
      describe("WHEN alice tries to swap 23500 TP 0 for 525 TP 1 via vendor without sending the AC for the markup", function () {
        it("THEN tx reverts because AC received is below the minimum required", async function () {
          // qACmax = 1% for qACfee of 100AC
          await expect(
            mocFunctions.swapTPforTP({
              iFrom: TP_0,
              iTo: TP_1,
              from: alice,
              qTP: 23500,
              qTPmin: 525,
              qACmax: 1,
              vendor,
            }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.INSUFFICIENT_QAC_SENT);
        });
      });
      describe("WHEN alice swaps 23500 TP 0 for 525 TP 1 via vendor", function () {
        let alicePrevACBalance: Balance;
        let vendorPrevACBalance: Balance;
        let tx: ContractTransaction;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          vendorPrevACBalance = await mocFunctions.acBalanceOf(vendor);
          tx = await mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23500, qTPmin: 525, vendor });
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
        it("THEN a TPSwappedForTP event is emitted", async function () {
          // iFrom: 0
          // iTo: 1
          // sender: alice || mocWrapper
          // receiver: alice
          // qTPfrom: 23500 TP
          // qTPto: 525 TP
          // qACfee: 1% AC
          // qFeeToken: 0
          // qACVendorMarkup: 10% AC
          // qFeeTokenVendorMarkup: 0
          await expect(tx)
            .to.emit(mocImpl, "TPSwappedForTP")
            .withArgs(TP_0, TP_1, operator, alice, pEth(23500), pEth(525), pEth(100 * 0.01), 0, pEth(100 * 0.1), 0);
        });
      });
      describe("WHEN alice swaps 23500 TP 0 for 525 TP 1 to bob via vendor", function () {
        let tx: ContractTransaction;
        beforeEach(async function () {
          tx = await mocFunctions.swapTPforTPto({
            iFrom: TP_0,
            iTo: TP_1,
            from: alice,
            to: bob,
            qTP: 23500,
            qTPmin: 525,
            vendor,
          });
        });
        it("THEN a TPSwappedForTP event is emitted", async function () {
          // iFrom: 0
          // iTo: 1
          // sender: alice || mocWrapper
          // receiver: bob
          // qTPfrom: 23500 TP
          // qTPto: 525 TP
          // qACfee: 1% AC
          // qFeeToken: 0
          // qACVendorMarkup: 10% AC
          // qFeeTokenVendorMarkup: 0
          await expect(tx)
            .to.emit(mocImpl, "TPSwappedForTP")
            .withArgs(TP_0, TP_1, operator, bob, pEth(23500), pEth(525), pEth(100 * 0.01), 0, pEth(100 * 0.1), 0);
        });
      });
      describe("WHEN alice swap 2350 TP 0 for 52.5 TP 4. ctargemaTP 4 > ctargemaTP 0, so coverage is checked", function () {
        /*
          ctargemaTP0 = 5
          ctargemaTP4 = 6
        */
        beforeEach(async function () {
          coverageBefore = await mocImpl.getCglb();
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocImpl.address);
          tx = await mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_4, from: alice, qTP: 2350, qTPmin: 52.5 });
        });
        it("THEN coverage didn't change", async function () {
          assertPrec(coverageBefore, await mocImpl.getCglb());
        });
        it("THEN Moc balance didn't change", async function () {
          assertPrec(mocPrevACBalance, await mocFunctions.acBalanceOf(mocImpl.address));
        });
        it("THEN a TPSwappedForTP event is emitted", async function () {
          // iFrom: 0
          // iTo: 4
          // sender: alice || mocWrapper
          // receiver: alice
          // qTPfrom: 2350 TP
          // qTPto: 52.5 TP
          // qACfee: 1% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expect(tx)
            .to.emit(mocImpl, "TPSwappedForTP")
            .withArgs(TP_0, TP_4, operator, alice, pEth(2350), pEth(52.5), pEth(10 * 0.01), 0, 0, 0);
        });
      });
      describe("AND 2500 TP 4 are minted", function () {
        beforeEach(async function () {
          await mocFunctions.mintTP({ i: TP_4, from: deployer, qTP: 2500 });
        });
        it("THEN tx reverts because there is not enough TP 4 to mint", async function () {
          await expect(
            mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_4, from: alice, qTP: 2350, qTPmin: 52.5 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.INSUFFICIENT_TP_TO_MINT);
        });
      });
      describe("AND TP 0 revalues to 10.5", function () {
        /*
          nAC = 3100    
          nTP = 23500
          lckAC = 2238.09
          coverage = 1.38
        */
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 10.5);
        });
        describe("WHEN alice swap 2350 TP 0 for 1175 TP 1", function () {
          /*
            ctargemaTP0 = 5
            ctargemaTP1 = 4
          */
          beforeEach(async function () {
            coverageBefore = await mocImpl.getCglb();
            mocPrevACBalance = await mocFunctions.acBalanceOf(mocImpl.address);
            tx = await mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 2350, qTPmin: 1175 });
          });
          it("THEN coverage didn't change", async function () {
            assertPrec(coverageBefore, await mocImpl.getCglb());
          });
          it("THEN Moc balance didn't change", async function () {
            assertPrec(mocPrevACBalance, await mocFunctions.acBalanceOf(mocImpl.address));
          });
          it("THEN a TPSwappedForTP event is emitted", async function () {
            // iFrom: 0
            // iTo: 1
            // sender: alice || mocWrapper
            // receiver: alice
            // qTPfrom: 2350 TP
            // qTPto: 1175 TP
            // qACfee: 1% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expect(tx)
              .to.emit(mocImpl, "TPSwappedForTP")
              .withArgs(TP_0, TP_1, operator, alice, pEth(2350), pEth(1175), pEth("2.238095238095238095"), 0, 0, 0);
          });
        });
        describe("WHEN alice swap 2350 TP 0 for 1175 TP 4. ctargemaTP 4 > ctargemaTP 0, so coverage is checked", function () {
          /*
            ctargemaTP0 = 5
            ctargemaTP4 = 6
          */
          it("THEN tx reverts because low coverage", async function () {
            await expect(
              mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_4, from: alice, qTP: 2350, qTPmin: 1175 }),
            ).to.be.revertedWithCustomError(mocImpl, ERRORS.LOW_COVERAGE);
          });
        });
      });
      describe("AND TP 0 devalues to 470", function () {
        /*
          nAC = 3100    
          nTP = 23500 + 11750
          lckAC = 50 + 25
          nACgain = 5
          coverage = 121.37
        */
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 470);
        });
        describe("WHEN alice swap 23500 TP 0 for 262.5 TP 1", function () {
          /*
            ctargemaTP0 = 5
            ctargemaTP1 = 4
          */
          beforeEach(async function () {
            coverageBefore = await mocImpl.getCglb();
            mocPrevACBalance = await mocFunctions.acBalanceOf(mocImpl.address);
            tx = await mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23500, qTPmin: 262.5 });
          });
          it("THEN coverage didn't change", async function () {
            assertPrec(coverageBefore, await mocImpl.getCglb());
          });
          it("THEN Moc balance didn't change", async function () {
            assertPrec(mocPrevACBalance, await mocFunctions.acBalanceOf(mocImpl.address));
          });
          it("THEN a TPSwappedForTP event is emitted", async function () {
            // iFrom: 0
            // iTo: 1
            // sender: alice || mocWrapper
            // receiver: alice
            // qTPfrom: 23500 TP
            // qTPto: 262.5 TP
            // qACfee: 1% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expect(tx)
              .to.emit(mocImpl, "TPSwappedForTP")
              .withArgs(TP_0, TP_1, operator, alice, pEth(23500), pEth(262.5), pEth(50 * 0.01), 0, 0, 0);
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
        describe("WHEN alice swaps 23500 TP 0 for 525 TP 1", function () {
          beforeEach(async function () {
            tx = await mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23500, qTPmin: 525 });
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
            // iFrom: 0
            // iTo: 0
            // sender: alice || mocWrapper
            // receiver: alice
            // qTPfrom: 23500 TP
            // qTPto: 525 TP
            // qACfee: 0
            // qFeeToken: 100 (1% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expect(tx)
              .to.emit(mocImpl, "TPSwappedForTP")
              .withArgs(TP_0, TP_1, operator, alice, pEth(23500), pEth(525), 0, pEth(0.5), 0, 0);
          });
        });
        describe("WHEN alice swaps 23500 TP 0 for 525 TP 1", function () {
          beforeEach(async function () {
            tx = await mocFunctions.swapTPforTPto({
              iFrom: TP_0,
              iTo: TP_1,
              from: alice,
              to: bob,
              qTP: 23500,
              qTPmin: 525,
            });
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
            // iFrom: 0
            // iTo: 1
            // sender: alice || mocWrapper
            // receiver: bob
            // qTPfrom: 23500 TP
            // qTPto: 525 TP
            // qACfee: 0
            // qFeeToken: 100 (1% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expect(tx)
              .to.emit(mocImpl, "TPSwappedForTP")
              .withArgs(TP_0, TP_1, operator, bob, pEth(23500), pEth(525), 0, pEth(0.5), 0, 0);
          });
        });
      });
    });
  });
};
export { swapTPforTPBehavior };
