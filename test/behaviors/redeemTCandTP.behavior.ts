import hre, { getNamedAccounts, ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { beforeEach } from "mocha";
import { assertPrec } from "../helpers/assertHelper";
import { Balance, ERRORS, pEth, CONSTANTS } from "../helpers/utils";
import { getNetworkDeployParams } from "../../scripts/utils";
import { MocCACoinbase, MocCARC20 } from "../../typechain";

const redeemTCandTPBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let alice: Address;
  let bob: Address;
  let operator: Address;
  let vendor: Address;
  const TP_0 = 0;
  const TP_1 = 1;
  const TP_4 = 4;

  const { mocFeeFlowAddress } = getNetworkDeployParams(hre).mocAddresses;

  let coverageBefore: BigNumber;
  let tcPriceBefore: BigNumber;
  let tcLeverageBefore: BigNumber;
  let alicePrevTCBalance: Balance;
  let alicePrevTPBalance: Balance;
  let alicePrevACBalance: Balance;
  let bobPrevACBalance: Balance;
  let mocPrevACBalance: Balance;
  let mocFeeFlowPrevACBalance: Balance;
  let tx: ContractTransaction;

  describe("Feature: joint Redeem TC and TP operation", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ mocImpl } = mocContracts);
      ({ alice, bob, vendor } = await getNamedAccounts());
      operator = mocContracts.mocWrapper?.address || alice;
    });

    describe("GIVEN alice has 3000 TC, 23500 TP 0", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 3000 });
        await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500 });
      });
      describe("WHEN alice tries to redeem 0 TP", function () {
        it("THEN tx reverts because the amount of TP is invalid", async function () {
          await expect(
            mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 0 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.INSUFFICIENT_QTP_SENT);
        });
      });
      describe("WHEN alice tries to redeem 0 TC", function () {
        it("THEN tx reverts because the amount of TC is too low and out of precision", async function () {
          await expect(
            mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 0, qTP: 23500 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO);
        });
      });
      describe("WHEN alice tries to redeem 100 TC and 23500 TP to the zero address", function () {
        it("THEN tx reverts because recipient is the zero address", async function () {
          await expect(
            mocFunctions.redeemTCandTPto({ i: TP_0, from: alice, to: CONSTANTS.ZERO_ADDRESS, qTC: 100, qTP: 23500 }),
          ).to.be.reverted;
        });
      });
      describe("WHEN alice tries to redeem 3001 TC and 2350000 TP", function () {
        it("THEN tx reverts because alice doesn't have that much TC and TP", async function () {
          await expect(mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 3001, qTP: 2350000 })).to.be.reverted;
        });
      });
      describe("WHEN alice redeems 100 TC and 723500 TP expecting 98.17 Asset", function () {
        it("THEN tx reverts because Asset received is below the minimum required", async function () {
          await expect(
            mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500, qACmin: 98.17 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.QAC_BELOW_MINIMUM);
        });
      });
      describe("WHEN alice redeems 1000 TC and 783.33 TP (less amount of TP)", function () {
        /*
        nAC = 3100
        lckAC = 100
        coverage = 31
        pTCac = 1
        => to redeem 100 TC we need 783.3 TP
        */
        it("THEN tx reverts because sent insufficient amount of TP", async function () {
          await expect(
            mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 1000, qTP: "783.333333333333333334" }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.INSUFFICIENT_QTP_SENT);
        });
      });
      describe("WHEN alice redeems 100 TC and 783.33 TP (exactly amount of TP)", function () {
        /*
            nAC = 3100
            lckAC = 100
            coverage = 31
            pTCac = 1
            => to redeem 100 TC we use 783.3 TP
            => AC redeemed = 100 AC - 8% + 3.33AC - 8% = 95.066
        */
        beforeEach(async function () {
          [
            coverageBefore,
            tcPriceBefore,
            tcLeverageBefore,
            alicePrevTCBalance,
            alicePrevTPBalance,
            alicePrevACBalance,
            bobPrevACBalance,
            mocPrevACBalance,
            mocFeeFlowPrevACBalance,
          ] = await Promise.all([
            mocImpl.getCglb(),
            mocImpl.getPTCac(),
            mocImpl.getLeverageTC(),
            mocFunctions.tcBalanceOf(alice),
            mocFunctions.tpBalanceOf(TP_0, alice),
            mocFunctions.assetBalanceOf(alice),
            mocFunctions.assetBalanceOf(bob),
            mocFunctions.acBalanceOf(mocImpl.address),
            mocFunctions.acBalanceOf(mocFeeFlowAddress),
          ]);
          tx = await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: "783.333333333333333333" });
        });
        it("THEN coverage did not change", async function () {
          assertPrec(coverageBefore, await mocImpl.getCglb());
        });
        it("THEN TC price did not change", async function () {
          assertPrec(tcPriceBefore, await mocImpl.getPTCac());
        });
        it("THEN TC leverage did not change", async function () {
          assertPrec(tcLeverageBefore, await mocImpl.getLeverageTC());
        });
        it("THEN alice TC balance decrease 100 TC", async function () {
          const aliceActualTCBalance = await mocFunctions.tcBalanceOf(alice);
          const diff = alicePrevTCBalance.sub(aliceActualTCBalance);
          assertPrec(100, diff);
        });
        it("THEN alice TP balance decrease 783.33 TP", async function () {
          const aliceActualTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          const diff = alicePrevTPBalance.sub(aliceActualTPBalance);
          assertPrec("783.333333333333333333", diff);
        });
        it("THEN alice AC balance increase 95.066 AC", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = aliceActualACBalance.sub(alicePrevACBalance);
          assertPrec("95.066666666666666667", diff);
        });
        it("THEN Moc balance decrease 103.33 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocImpl.address);
          const diff = mocPrevACBalance.sub(mocActualACBalance);
          assertPrec("103.333333333333333333", diff);
        });
        it("THEN Moc Fee Flow balance increase 8% of 100 AC + 8% of 3.33 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec("8.266666666666666666", diff);
        });
        it("THEN a TCandTPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: alice || mocWrapper
          // qTC: 100 TC
          // qTP: 783.33 TP
          // qAC: 103.33 AC - 8% for Moc Fee Flow
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expect(tx)
            .to.emit(mocImpl, "TCandTPRedeemed")
            .withArgs(
              TP_0,
              operator,
              operator,
              pEth(100),
              pEth("783.333333333333333333"),
              pEth("95.066666666666666667"),
              pEth("8.266666666666666666"),
              0,
              0,
              0,
            );
        });
        it("THEN a Collateral Token Transfer event is emitted", async function () {
          // from: alice || mocWrapper
          // to: Zero Address
          // amount: 100 TC
          await expect(tx)
            .to.emit(mocContracts.mocCollateralToken, "Transfer")
            .withArgs(operator, CONSTANTS.ZERO_ADDRESS, pEth(100));
        });
        it("THEN a Pegged Token Transfer event is emitted", async function () {
          // from: alice || mocWrapper
          // to: Zero Address
          // amount: 783.33 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[TP_0], "Transfer")
            .withArgs(operator, CONSTANTS.ZERO_ADDRESS, pEth("783.333333333333333333"));
        });
      });
      describe("WHEN alice redeems 100 TC and 23500 TP (more amount of TP) to bob", function () {
        /*
            nAC = 3100
            lckAC = 100
            coverage = 31
            pTCac = 1
            => to redeem 100 TC we use 783.3 TP
            => AC redeemed = 100 AC - 8% + 3.33AC - 8% = 95.066
        */
        beforeEach(async function () {
          [coverageBefore, tcPriceBefore, tcLeverageBefore, bobPrevACBalance] = await Promise.all([
            mocImpl.getCglb(),
            mocImpl.getPTCac(),
            mocImpl.getLeverageTC(),
            mocFunctions.assetBalanceOf(bob),
          ]);
          tx = await mocFunctions.redeemTCandTPto({ i: TP_0, from: alice, to: bob, qTC: 100, qTP: 23500 });
        });
        it("THEN coverage did not change", async function () {
          assertPrec(coverageBefore, await mocImpl.getCglb());
        });
        it("THEN TC price did not change", async function () {
          assertPrec(tcPriceBefore, await mocImpl.getPTCac());
        });
        it("THEN TC leverage did not change", async function () {
          assertPrec(tcLeverageBefore, await mocImpl.getLeverageTC());
        });
        it("THEN bob AC balance increase 95.06 AC", async function () {
          const bobActualACBalance = await mocFunctions.assetBalanceOf(bob);
          const diff = bobActualACBalance.sub(bobPrevACBalance);
          assertPrec("95.066666666666666667", diff);
        });
        it("THEN a TCandTPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: bob || mocWrapper
          // qTC: 100 TC
          // qTP: 783.33 TP
          // qAC: 103.33 AC - 8% for Moc Fee Flow
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expect(tx)
            .to.emit(mocImpl, "TCandTPRedeemed")
            .withArgs(
              TP_0,
              operator,
              mocContracts.mocWrapper?.address || bob,
              pEth(100),
              pEth("783.333333333333333333"),
              pEth("95.066666666666666667"),
              pEth("8.266666666666666666"),
              0,
              0,
              0,
            );
        });
      });
      describe("WHEN alice redeems 100 TC and 783.33 TP via vendor", function () {
        let alicePrevACBalance: Balance;
        let vendorPrevACBalance: Balance;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          vendorPrevACBalance = await mocFunctions.acBalanceOf(vendor);
          tx = await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500, vendor });
        });
        it("THEN alice AC balance increase 84.73 Asset (103.33 qAC - 8% qACFee - 10% qACVendorMarkup)", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = aliceActualACBalance.sub(alicePrevACBalance);
          assertPrec("84.733333333333333334", diff);
        });
        it("THEN vendor AC balance increase 10.33 Asset", async function () {
          const vendorActualACBalance = await mocFunctions.acBalanceOf(vendor);
          const diff = vendorActualACBalance.sub(vendorPrevACBalance);
          assertPrec("10.333333333333333333", diff);
        });
        it("THEN a TCandTPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: alice || mocWrapper
          // qTC: 100 TC
          // qTP: 783.33 TP
          // qAC: 103.33 AC - 8% for Moc Fee Flow - 10% for vendor
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expect(tx)
            .to.emit(mocImpl, "TCandTPRedeemed")
            .withArgs(
              TP_0,
              operator,
              operator,
              pEth(100),
              pEth("783.333333333333333333"),
              pEth("84.733333333333333334"),
              pEth("8.266666666666666666"),
              0,
              pEth("10.333333333333333333"),
              0,
            );
        });
      });
      describe("WHEN alice redeems 100 TC and 783.33 TP to bob via vendor", function () {
        beforeEach(async function () {
          tx = await mocFunctions.redeemTCandTPto({ i: TP_0, from: alice, to: bob, qTC: 100, qTP: 23500, vendor });
        });
        it("THEN a TCandTPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: bob || mocWrapper
          // qTC: 100 TC
          // qTP: 783.33 TP
          // qAC: 103.33 AC - 8% for Moc Fee Flow - 10% for vendor
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expect(tx)
            .to.emit(mocImpl, "TCandTPRedeemed")
            .withArgs(
              TP_0,
              operator,
              mocContracts.mocWrapper?.address || bob,
              pEth(100),
              pEth("783.333333333333333333"),
              pEth("84.733333333333333334"),
              pEth("8.266666666666666666"),
              0,
              pEth("10.333333333333333333"),
              0,
            );
        });
      });
      describe("AND TP 0 revalues to 10 making TC price to drop and protocol to be in low coverage", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 10);
        });
        describe("WHEN alice redeems 100 TC and 23500 TP (more amount of TP)", function () {
          /*
            nAC = 3100
            lckAC = 2350
            coverage = 1.319
            pTCac = 0.25
            => to redeem 100 TC we use 783.33 TP
            => AC redeemed = 25 AC - 8% + 78.33AC - 8% = 95.066
          */
          beforeEach(async function () {
            [coverageBefore, tcPriceBefore, tcLeverageBefore] = await Promise.all([
              mocImpl.getCglb(),
              mocImpl.getPTCac(),
              mocImpl.getLeverageTC(),
            ]);
            tx = await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500 });
          });
          it("THEN coverage did not change", async function () {
            assertPrec(coverageBefore, await mocImpl.getCglb());
          });
          it("THEN TC price did not change", async function () {
            assertPrec(tcPriceBefore, await mocImpl.getPTCac());
          });
          it("THEN TC leverage did not change", async function () {
            assertPrec(tcLeverageBefore, await mocImpl.getLeverageTC());
          });
          it("THEN a TCandTPRedeemed event is emitted", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: alice || mocWrapper
            // qTC: 100 TC
            // qTP: 783.33 TP
            // qAC: 103.33 AC - 8% for Moc Fee Flow
            // qACfee: 8% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expect(tx)
              .to.emit(mocImpl, "TCandTPRedeemed")
              .withArgs(
                TP_0,
                operator,
                operator,
                pEth(100),
                pEth("783.333333333333333333"),
                pEth("95.066666666666666667"),
                pEth("8.266666666666666666"),
                0,
                0,
                0,
              );
          });
        });
      });
      describe("AND TP 0 devaluates to 470 making TC price to rise", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 470);
        });
        describe("WHEN alice redeems 100 TC and 23500 TP (more amount of TP)", function () {
          /*
            nAC = 3100
            lckAC = 50 + 25(tpGain)
            nACgain = 5
            coverage = 41.266
            pTCac = 1.0066
            => to redeem 100 TC we use 1175 TP
            => AC redeemed = 100.66 AC - 8% + 2.5AC - 8% = 94.91
          */
          beforeEach(async function () {
            [coverageBefore, tcPriceBefore, tcLeverageBefore] = await Promise.all([
              mocImpl.getCglb(),
              mocImpl.getPTCac(),
              mocImpl.getLeverageTC(),
            ]);
            tx = await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500 });
          });
          it("THEN coverage did not change", async function () {
            assertPrec(coverageBefore, await mocImpl.getCglb(), undefined, 1);
          });
          it("THEN TC price did not change", async function () {
            assertPrec(tcPriceBefore, await mocImpl.getPTCac());
          });
          it("THEN TC leverage did not change", async function () {
            assertPrec(tcLeverageBefore, await mocImpl.getLeverageTC());
          });
          it("THEN a TCandTPRedeemed event is emitted", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: alice || mocWrapper
            // qTC: 100 TC
            // qTP: 1175 TP
            // qAC: 103.16 AC - 8% for Moc Fee Flow
            // qACfee: 8% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expect(tx)
              .to.emit(mocImpl, "TCandTPRedeemed")
              .withArgs(
                TP_0,
                operator,
                operator,
                pEth(100),
                pEth(1175),
                pEth("94.913333333333333272"),
                pEth("8.253333333333333328"),
                0,
                0,
                0,
              );
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
          await expect(
            mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.LOW_COVERAGE);
        });
      });
      describe("AND alice has FeeToken to pay fees", function () {
        let alicePrevFeeTokenBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        let mocFeeFlowPrevFeeTokenBalance: Balance;
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
        describe("WHEN alice redeems 100 TC and 783.33 TP", function () {
          let alicePrevACBalance: Balance;
          beforeEach(async function () {
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            tx = await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500 });
          });
          it("THEN alice AC balance increase 103.33 Asset", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = aliceActualACBalance.sub(alicePrevACBalance);
            assertPrec("103.333333333333333333", diff);
          });
          it("THEN alice Fee Token balance decrease 4.13 (103.33 * 8% * 50%)", async function () {
            const aliceActualFeeTokenBalance = await mocContracts.feeToken.balanceOf(alice);
            const diff = alicePrevFeeTokenBalance.sub(aliceActualFeeTokenBalance);
            assertPrec("4.133333333333333333", diff);
          });
          it("THEN Moc Fee Flow AC balance doesn't change", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
            assertPrec(mocFeeFlowActualACBalance, mocFeeFlowPrevACBalance);
          });
          it("THEN Moc Fee Flow Fee Token balance increase 4.13 (103.33 * 8% * 50%)", async function () {
            const mocFeeFlowActualFeeTokenBalance = await mocContracts.feeToken.balanceOf(mocFeeFlowAddress);
            const diff = mocFeeFlowActualFeeTokenBalance.sub(mocFeeFlowPrevFeeTokenBalance);
            assertPrec("4.133333333333333333", diff);
          });
          it("THEN Fee Token is used as fee payment method", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: alice || mocWrapper
            // qTC: 100 TC
            // qTP: 783.33 TP
            // qAC: 103.33 AC
            // qACfee: 0 AC
            // qFeeToken: 103.33 (8% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expect(tx)
              .to.emit(mocImpl, "TCandTPRedeemed")
              .withArgs(
                TP_0,
                operator,
                operator,
                pEth(100),
                pEth("783.333333333333333333"),
                pEth("103.333333333333333333"),
                0,
                pEth("4.133333333333333333"),
                0,
                0,
              );
          });
        });
        describe("WHEN alice redeems 100 TC and 783.33 TP to bob", function () {
          let bobPrevACBalance: Balance;
          beforeEach(async function () {
            bobPrevACBalance = await mocFunctions.assetBalanceOf(bob);
            tx = await mocFunctions.redeemTCandTPto({ i: TP_0, from: alice, to: bob, qTC: 100, qTP: 23500 });
          });
          it("THEN bob AC balance increase 103.33 Asset", async function () {
            const bobActualACBalance = await mocFunctions.assetBalanceOf(bob);
            const diff = bobActualACBalance.sub(bobPrevACBalance);
            assertPrec("103.333333333333333333", diff);
          });
          it("THEN alice Fee Token balance decrease 4.13 (103.33 * 8% * 50%)", async function () {
            const aliceActualFeeTokenBalance = await mocContracts.feeToken.balanceOf(alice);
            const diff = alicePrevFeeTokenBalance.sub(aliceActualFeeTokenBalance);
            assertPrec("4.133333333333333333", diff);
          });
          it("THEN Moc Fee Flow AC balance doesn't change", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
            assertPrec(mocFeeFlowActualACBalance, mocFeeFlowPrevACBalance);
          });
          it("THEN Moc Fee Flow Fee Token balance increase 4.13 (103.33 * 8% * 50%)", async function () {
            const mocFeeFlowActualFeeTokenBalance = await mocContracts.feeToken.balanceOf(mocFeeFlowAddress);
            const diff = mocFeeFlowActualFeeTokenBalance.sub(mocFeeFlowPrevFeeTokenBalance);
            assertPrec("4.133333333333333333", diff);
          });
          it("THEN Fee Token is used as fee payment method", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: bob || mocWrapper
            // qTC: 100 TC
            // qTP: 783.33 TP
            // qAC: 103.33 AC
            // qACfee: 0 AC
            // qFeeToken: 103.33 (8% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expect(tx)
              .to.emit(mocImpl, "TCandTPRedeemed")
              .withArgs(
                TP_0,
                operator,
                mocContracts.mocWrapper?.address || bob,
                pEth(100),
                pEth("783.333333333333333333"),
                pEth("103.333333333333333333"),
                0,
                pEth("4.133333333333333333"),
                0,
                0,
              );
          });
        });
      });
      describe("WHEN alice redeems all", function () {
        beforeEach(async function () {
          await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 3000, qTP: 23500 });
        });
        it("THEN coverage is max uint256", async function () {
          assertPrec(await mocImpl.getCglb(), CONSTANTS.MAX_UINT256);
        });
        it("THEN ctargemaCA is 4", async function () {
          assertPrec(await mocImpl.calcCtargemaCA(), 4);
        });
      });
      describe("AND alice has TP 1 and TP 4", function () {
        beforeEach(async function () {
          await mocFunctions.mintTP({ i: TP_1, from: alice, qTP: 2500 });
          await mocFunctions.mintTP({ i: TP_4, from: alice, qTP: 1000 });
          // nAC = 3766.66
          // lckAC = 766.66
          // coverage = 4.913043478260869565
          // ctargemaCA = 4.863579003610006783
        });
        describe("WHEN alice redeems 100 TC using TP 4, which ctarg is bigger than ctargemaCA", function () {
          beforeEach(async function () {
            // assert coverage is above ctargemaCA before the operation
            expect(await mocImpl.getCglb()).to.be.greaterThanOrEqual(await mocImpl.calcCtargemaCA());
            tx = await mocFunctions.redeemTCandTP({ i: TP_4, from: alice, qTC: 100, qTP: 1000 });
          });
          it("THEN coverage is still above ctargemaCA", async function () {
            // coverage = 4.877732022794360916
            // ctargemaCA = 4.828713917473026893
            expect(await mocImpl.getCglb()).to.be.greaterThanOrEqual(await mocImpl.calcCtargemaCA());
          });
          it("THEN a 98.73 TP 4 are redeemed", async function () {
            // i: 4
            // sender: alice || mocWrapper
            // receiver: alice || mocWrapper
            // qTC: 100 TC
            // qTP: 98.73 TP
            // qAC: 118.8 AC - 8% for Moc Fee Flow
            // qACfee: 8% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expect(tx)
              .to.emit(mocImpl, "TCandTPRedeemed")
              .withArgs(
                TP_4,
                operator,
                operator,
                pEth(100),
                pEth("98.735907870033506676"),
                pEth("109.302292426748728789"),
                pEth("9.504547167543367720"),
                0,
                0,
                0,
              );
          });
        });
        describe("WHEN alice redeems 1000 TC using TP 1, which ctarg is lower than ctargemaCA", function () {
          beforeEach(async function () {
            // assert coverage is above ctargemaCA before the operation
            expect(await mocImpl.getCglb()).to.be.greaterThanOrEqual(await mocImpl.calcCtargemaCA());
            tx = await mocFunctions.redeemTCandTP({ i: TP_1, from: alice, qTC: 1000, qTP: 2500 });
          });
          it("THEN coverage is still above ctargemaCA", async function () {
            // coverage = 5.396869700032148655
            // ctargemaCA = 5.341289216189160902
            expect(await mocImpl.getCglb()).to.be.greaterThanOrEqual(await mocImpl.calcCtargemaCA());
          });
          it("THEN a 1636.95 TP 1 are redeemed", async function () {
            // i: 1
            // sender: alice || mocWrapper
            // receiver: alice || mocWrapper
            // qTC: 1000 TC
            // qTP: 1636.93 TP
            // qAC: 1311.79 AC - 8% for Moc Fee Flow
            // qACfee: 8% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expect(tx)
              .to.emit(mocImpl, "TCandTPRedeemed")
              .withArgs(
                TP_1,
                operator,
                operator,
                pEth(1000),
                pEth("1636.937419950555505676"),
                pEth("1206.853795496097345756"),
                pEth("104.943808304008464848"),
                0,
                0,
                0,
              );
          });
        });
      });
    });
  });
};

export { redeemTCandTPBehavior };
