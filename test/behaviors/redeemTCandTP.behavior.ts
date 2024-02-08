import hre, { getNamedAccounts, ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { beforeEach } from "mocha";
import { assertPrec } from "../helpers/assertHelper";
import { Balance, ERRORS, pEth, CONSTANTS, expectEventFor, getNetworkDeployParams, noVendor } from "../helpers/utils";
import { MocCACoinbase, MocCARC20 } from "../../typechain";

const redeemTCandTPBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let alice: Address;
  let bob: Address;
  let vendor: Address;
  let expectEvent: any;
  let assertACResult: any;
  let tps: Address[];
  const TP_0 = 0;
  const TP_1 = 1;
  const TP_4 = 4;
  const {
    mocAddresses: { mocFeeFlowAddress },
    queueParams: {
      execFeeParams: { redeemTCandTPExecFee },
    },
  } = getNetworkDeployParams(hre);

  let tcPriceBefore: BigNumber;
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
      expectEvent = expectEventFor(mocContracts, "TCandTPRedeemed");
      assertACResult = mocFunctions.assertACResult(-redeemTCandTPExecFee);
      tps = mocContracts.mocPeggedTokens.map((it: any) => it.address);
    });

    describe("GIVEN alice has 3000 TC, 23500 TP 0", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 3000 });
        await mocFunctions.mintTP({ from: alice, qTP: 23500 });
      });
      describe("WHEN alice tries to redeem 0 TP", function () {
        it("THEN tx reverts because the amount of TP is invalid", async function () {
          await expect(mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 0 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.INSUFFICIENT_QTP_SENT,
          );
        });
      });
      describe("WHEN alice tries to redeem 0 TC", function () {
        it("THEN tx reverts because the amount of TC is too low and out of precision", async function () {
          await expect(mocFunctions.redeemTCandTP({ from: alice, qTC: 0, qTP: 23500 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO,
          );
        });
      });
      describe("WHEN alice tries to redeem 100 TC and 23500 TP to the zero address", function () {
        it("THEN tx reverts because recipient is the zero address", async function () {
          await expect(mocFunctions.redeemTCandTP({ from: alice, to: CONSTANTS.ZERO_ADDRESS, qTC: 100, qTP: 23500 })).to
            .be.reverted;
        });
      });
      describe("WHEN alice tries to redeem 3001 TC and 2350000 TP", function () {
        it("THEN tx reverts because alice doesn't have that much TC and TP", async function () {
          await expect(mocFunctions.redeemTCandTP({ from: alice, qTC: 3001, qTP: 2350000 })).to.be.reverted;
        });
      });
      describe("WHEN alice redeems 100 TC and 5175 TP expecting 112.26 Asset", function () {
        it("THEN tx reverts because Asset received is below the minimum required", async function () {
          await expect(
            mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 5175, qACmin: 112.26 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.QAC_BELOW_MINIMUM);
        });
      });
      describe("WHEN alice redeems 1000 TC and 5174.6073 TP (less amount of TP)", function () {
        /*
          coverage = 31
          ctargemaCA = 5.54
          ctargemaTP = 5.54
          qTP = (100 * 235) / (1 * (5.54 - 1)) = 5174.6074 TP0
        */
        it("THEN tx reverts because sent insufficient amount of TP", async function () {
          await expect(
            mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: "5174.607460330647171984" }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.INSUFFICIENT_QTP_SENT);
        });
      });
      describe("WHEN alice redeems 100 TC and 5174.6074 TP (exactly amount of TP)", function () {
        /*
          coverage = 31
          ctargemaCA = 5.54
          ctargemaTP = 5.54
          qTP = (100 * 235) / (1 * (5.54 - 1)) = 5174.6074 TP0
          => AC redeemed = 100 AC - 8% + 22.01AC - 8% = 112.25
        */
        beforeEach(async function () {
          [
            tcPriceBefore,
            alicePrevTCBalance,
            alicePrevTPBalance,
            alicePrevACBalance,
            bobPrevACBalance,
            mocPrevACBalance,
            mocFeeFlowPrevACBalance,
          ] = await Promise.all([
            mocImpl.getPTCac(),
            mocFunctions.tcBalanceOf(alice),
            mocFunctions.tpBalanceOf(TP_0, alice),
            mocFunctions.assetBalanceOf(alice),
            mocFunctions.assetBalanceOf(bob),
            mocFunctions.acBalanceOf(mocImpl.address),
            mocFunctions.acBalanceOf(mocFeeFlowAddress),
          ]);
          tx = await mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: "5174.607460330647171985" });
        });
        it("THEN coverage increase to 38.18", async function () {
          assertPrec(await mocImpl.getCglb(), "38.188835029031055240");
        });
        it("THEN TC price did not change", async function () {
          assertPrec(tcPriceBefore, await mocImpl.getPTCac());
        });
        it("THEN TC leverage decrease to 1.02", async function () {
          assertPrec(await mocImpl.getLeverageTC(), "1.026889790960630011");
        });
        it("THEN alice TC balance decrease 100 TC", async function () {
          const aliceActualTCBalance = await mocFunctions.tcBalanceOf(alice);
          const diff = alicePrevTCBalance.sub(aliceActualTCBalance);
          assertPrec(100, diff);
        });
        it("THEN alice TP balance decrease 5174.6074 TP", async function () {
          const aliceActualTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          const diff = alicePrevTPBalance.sub(aliceActualTPBalance);
          assertPrec("5174.607460330647171985", diff);
        });
        it("THEN alice AC balance increase 112.25 AC", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = aliceActualACBalance.sub(alicePrevACBalance);
          assertACResult("112.258037717039129354", diff);
        });
        it("THEN Moc balance decrease 122.01 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocImpl.address);
          const diff = mocPrevACBalance.sub(mocActualACBalance);
          assertPrec("122.019606214172966689", diff);
        });
        it("THEN Moc Fee Flow balance increase 8% of 100 AC + 8% of 22.01 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec("9.761568497133837335", diff);
        });
        it("THEN a TCandTPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice
          // receiver: alice
          // qTC: 100 TC
          // qTP: 5174.6 TP
          // qAC: 122.01 AC - 8% for Moc Fee Flow
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[TP_0],
            alice,
            alice,
            pEth(100),
            pEth("5174.607460330647171985"),
            pEth("112.258037717039129354"),
            pEth("9.761568497133837335"),
            0,
            0,
            0,
            noVendor,
          ]);
        });
        it("THEN a Collateral Token Transfer event is emitted", async function () {
          // from: Moc
          // to: Zero Address
          // amount: 100 TC
          await expect(tx)
            .to.emit(mocContracts.mocCollateralToken, "Transfer")
            .withArgs(mocImpl.address, CONSTANTS.ZERO_ADDRESS, pEth(100));
        });
        it("THEN a Pegged Token Transfer event is emitted", async function () {
          // to: Zero Address
          // amount: 5174.607460330647171985 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[TP_0], "Transfer")
            .withArgs(mocImpl.address, CONSTANTS.ZERO_ADDRESS, pEth("5174.607460330647171985"));
        });
      });
      describe("WHEN alice redeems 100 TC and 23500 TP (more amount of TP) to bob", function () {
        /*
          coverage = 31
          ctargemaCA = 5.54
          ctargemaTP = 5.54
          qTP = (100 * 235) / (1 * (5.54 - 1)) = 5174.6074 TP0
          => AC redeemed = 100 AC - 8% + 22.01AC - 8% = 112.25
        */
        beforeEach(async function () {
          bobPrevACBalance = await mocFunctions.assetBalanceOf(bob);
          tx = await mocFunctions.redeemTCandTP({ from: alice, to: bob, qTC: 100, qTP: 23500 });
        });
        it("THEN bob AC balance increase 95.06 AC", async function () {
          const bobActualACBalance = await mocFunctions.assetBalanceOf(bob);
          const diff = bobActualACBalance.sub(bobPrevACBalance);
          assertPrec("112.258037717039129354", diff);
        });
        it("THEN a TCandTPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice
          // receiver: bob
          // qTC: 100 TC
          // qTP: 5174.6 TP
          // qAC: 122.01 AC - 8% for Moc Fee Flow
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[TP_0],
            alice,
            bob,
            pEth(100),
            pEth("5174.607460330647171985"),
            pEth("112.258037717039129354"),
            pEth("9.761568497133837335"),
            0,
            0,
            0,
            noVendor,
          ]);
        });
      });
      describe("WHEN alice redeems 100 TC and 5174.6 TP via vendor", function () {
        let alicePrevACBalance: Balance;
        let vendorPrevACBalance: Balance;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          vendorPrevACBalance = await mocFunctions.acBalanceOf(vendor);
          tx = await mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 23500, vendor });
        });
        it("THEN alice AC balance increase 100.05 Asset (122.01 qAC - 8% qACFee - 10% qACVendorMarkup)", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = aliceActualACBalance.sub(alicePrevACBalance);
          assertACResult("100.056077095621832686", diff);
        });
        it("THEN vendor AC balance increase 12.2 Asset", async function () {
          const vendorActualACBalance = await mocFunctions.acBalanceOf(vendor);
          const diff = vendorActualACBalance.sub(vendorPrevACBalance);
          assertPrec("12.201960621417296668", diff);
        });
        it("THEN a TCandTPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice
          // receiver: alice
          // qTC: 100 TC
          // qTP: 5174.6 TP
          // qAC: 122.01 AC - 8% for Moc Fee Flow - 10% for vendor
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 12.2
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[TP_0],
            alice,
            alice,
            pEth(100),
            pEth("5174.607460330647171985"),
            pEth("100.056077095621832686"),
            pEth("9.761568497133837335"),
            0,
            pEth("12.201960621417296668"),
            0,
            vendor,
          ]);
        });
      });
      describe("WHEN alice redeems 100 TC and 5174.6 TP to bob via vendor", function () {
        beforeEach(async function () {
          tx = await mocFunctions.redeemTCandTP({ from: alice, to: bob, qTC: 100, qTP: 23500, vendor });
        });
        it("THEN a TCandTPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice
          // receiver: bob
          // qTC: 100 TC
          // qTP: 5174.6 TP
          // qAC: 122.01 AC - 8% for Moc Fee Flow - 10% for vendor
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[TP_0],
            alice,
            bob,
            pEth(100),
            pEth("5174.607460330647171985"),
            pEth("100.056077095621832686"),
            pEth("9.761568497133837335"),
            0,
            pEth("12.201960621417296668"),
            0,
            vendor,
          ]);
        });
      });
      describe("AND TP 0 revalues to 10 making TC price to drop and protocol to be in low coverage", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 10);
        });
        describe("WHEN alice redeems 100 TC and 23500 TP (more amount of TP)", function () {
          /*
            coverage = 1.319
            pTCac = 0.25
            ctargemaCA = 5
            ctargemaTP = 5
            qTP = (100 * 10) / (0.25 * (1.319 - 1)) = 12533.33 TP0
            => AC redeemed = 25 AC - 8% + 78.33AC - 8% = 95.066
          */
          beforeEach(async function () {
            tx = await mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 23500 });
          });
          it("THEN coverage increase to 1.66", async function () {
            assertPrec(await mocImpl.getCglb(), "1.661094224924012160");
          });
          it("THEN TC leverage decrease to 2.51", async function () {
            assertPrec(await mocImpl.getLeverageTC(), "2.512643678160919535");
          });
          it("THEN a TCandTPRedeemed event is emitted", async function () {
            // i: 0
            // sender: alice
            // receiver: alice
            // qTC: 100 TC
            // qTP: 12533.33 TP
            // qAC: 1278.33 AC - 8% for Moc Fee Flow
            // qACfee: 8% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[TP_0],
              alice,
              alice,
              pEth(100),
              pEth("12533.333333333333370933"),
              pEth("1176.066666666666670126"),
              pEth("102.266666666666666967"),
              0,
              0,
              0,
              noVendor,
            ]);
          });
        });
      });
      describe("AND TP 0 devaluates to 470 making TC price to rise", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 470);
        });
        describe("WHEN alice redeems 100 TC and 23500 TP (more amount of TP)", function () {
          /*
            coverage = 41.266
            pTCac = 1.0066
            ctargemaCA = 11.08
            ctargemaTP = 11.08
            qTP = (100 * 470) / (1.0066 * (11.08 - 1)) = 4630.52 TP0
            => AC redeemed = 100.66 AC - 8% + 2.5AC - 8% = 94.91
          */
          beforeEach(async function () {
            tx = await mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 23500 });
          });
          it("THEN coverage increase to 45.81", async function () {
            assertPrec(await mocImpl.getCglb(), "45.810916627491855948");
          });
          it("THEN TC leverage decrease to 1.02", async function () {
            assertPrec(await mocImpl.getLeverageTC(), "1.022315990728618392");
          });
          it("THEN a TCandTPRedeemed event is emitted", async function () {
            // i: 0
            // sender: alice
            // receiver: alice
            // qTC: 100 TC
            // qTP: 4630.52 TP
            // qAC: 110.51 AC - 8% for Moc Fee Flow
            // qACfee: 8% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[TP_0],
              alice,
              alice,
              pEth(100),
              pEth("4630.526667805752568737"),
              pEth("101.677342980953104258"),
              pEth("8.841508085300269935"),
              0,
              0,
              0,
              noVendor,
            ]);
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
          await expect(mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 23500 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.LOW_COVERAGE,
          );
        });
      });
      describe("AND alice has FeeToken to pay fees", function () {
        let alicePrevFeeTokenBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        let mocFeeFlowPrevFeeTokenBalance: Balance;
        beforeEach(async function () {
          // mint FeeToken to alice
          await mocContracts.feeToken.mint(alice, pEth(50));
          await mocContracts.feeToken.connect(await ethers.getSigner(alice)).approve(mocImpl.address, pEth(50));

          // initialize previous balances
          alicePrevFeeTokenBalance = await mocContracts.feeToken.balanceOf(alice);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          mocFeeFlowPrevFeeTokenBalance = await mocContracts.feeToken.balanceOf(mocFeeFlowAddress);
        });
        describe("WHEN alice redeems 100 TC and 5174.6 TP", function () {
          let alicePrevACBalance: Balance;
          beforeEach(async function () {
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            tx = await mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 23500 });
          });
          it("THEN alice AC balance increase 122.01 Asset", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = aliceActualACBalance.sub(alicePrevACBalance);
            assertACResult("122.019606214172966689", diff);
          });
          it("THEN alice Fee Token balance decrease 4.99 (122.01 * 8% * 50%)", async function () {
            const aliceActualFeeTokenBalance = await mocContracts.feeToken.balanceOf(alice);
            const diff = alicePrevFeeTokenBalance.sub(aliceActualFeeTokenBalance);
            assertPrec("4.880784248566918667", diff);
          });
          it("THEN Moc Fee Flow AC balance doesn't change", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
            assertPrec(mocFeeFlowActualACBalance, mocFeeFlowPrevACBalance);
          });
          it("THEN Moc Fee Flow Fee Token balance increase 4.99 (122.01 * 8% * 50%)", async function () {
            const mocFeeFlowActualFeeTokenBalance = await mocContracts.feeToken.balanceOf(mocFeeFlowAddress);
            const diff = mocFeeFlowActualFeeTokenBalance.sub(mocFeeFlowPrevFeeTokenBalance);
            assertPrec("4.880784248566918667", diff);
          });
          it("THEN Fee Token is used as fee payment method", async function () {
            // i: 0
            // sender: alice
            // receiver: alice
            // qTC: 100 TC
            // qTP: 5174.6 TP
            // qAC: 122.01 AC
            // qACfee: 0 AC
            // qFeeToken: 122.01 (8% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[TP_0],
              alice,
              alice,
              pEth(100),
              pEth("5174.607460330647171985"),
              pEth("122.019606214172966689"),
              0,
              pEth("4.880784248566918667"),
              0,
              0,
              noVendor,
            ]);
          });
        });
        describe("WHEN alice redeems 100 TC and 5174.6 TP to bob", function () {
          let bobPrevACBalance: Balance;
          beforeEach(async function () {
            bobPrevACBalance = await mocFunctions.assetBalanceOf(bob);
            tx = await mocFunctions.redeemTCandTP({ from: alice, to: bob, qTC: 100, qTP: 23500 });
          });
          it("THEN bob AC balance increase 122.01 Asset", async function () {
            const bobActualACBalance = await mocFunctions.assetBalanceOf(bob);
            const diff = bobActualACBalance.sub(bobPrevACBalance);
            assertPrec("122.019606214172966689", diff);
          });
          it("THEN Fee Token is used as fee payment method", async function () {
            // i: 0
            // sender: alice
            // receiver: bob
            // qTC: 100 TC
            // qTP: 5174.6 TP
            // qAC: 122.01 AC
            // qACfee: 0 AC
            // qFeeToken: 122.01 (8% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[TP_0],
              alice,
              bob,
              pEth(100),
              pEth("5174.607460330647171985"),
              pEth("122.019606214172966689"),
              0,
              pEth("4.880784248566918667"),
              0,
              0,
              noVendor,
            ]);
          });
        });
      });
      describe("WHEN alice redeems all", function () {
        beforeEach(async function () {
          await mocFunctions.redeemTCandTP({ from: alice, qTC: "454.140728164497264600", qTP: 23500 });
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
        });
        describe("WHEN alice redeems 100 TC using TP 4, which ctarg is bigger than ctargemaCA", function () {
          beforeEach(async function () {
            // coverage = 4.913043478260869565
            // ctargemaCA = 4.863579003610006783
            // ctargemaTP4 = 6.25
            // assert coverage is above ctargemaCA before the operation
            expect(await mocImpl.getCglb()).to.be.gte(await mocImpl.calcCtargemaCA());
            tx = await mocFunctions.redeemTCandTP({ i: TP_4, from: alice, qTC: "735.919810211429863429", qTP: 1000 });
          });
          it("THEN coverage is still above ctargemaCA", async function () {
            // coverage = 4.929395370707435774
            // ctargemaCA = 4.405258013067860265
            expect(await mocImpl.getCglb()).to.be.gte(await mocImpl.calcCtargemaCA());
          });
          it("THEN a 98.73 TP 4 are redeemed", async function () {
            // i: 4
            // sender: alice
            // receiver: alice
            // qTC: 735.91 TC
            // qTP: 1000 TP
            // qAC: 926.39 AC - 8% for Moc Fee Flow
            // qACfee: 8% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[TP_4],
              alice,
              alice,
              pEth("735.919810211429863429"),
              pEth(1000),
              pEth("852.284320632610712450"),
              pEth("74.111680055009627169"),
              0,
              0,
              0,
              noVendor,
            ]);
          });
        });
        describe("WHEN alice redeems 1000 TC using TP 1, which ctarg is lower than ctargemaCA", function () {
          beforeEach(async function () {
            // coverage = 4.913043478260869565
            // ctargemaCA = 4.863579003610006783
            // ctargemaTP1 = 4.166
            // assert coverage is above ctargemaCA before the operation
            expect(await mocImpl.getCglb()).to.be.gte(await mocImpl.calcCtargemaCA());
            tx = await mocFunctions.redeemTCandTP({ i: TP_1, from: alice, qTC: "1507.936507936507936183", qTP: 2500 });
          });
          it("THEN coverage is still above ctargemaCA", async function () {
            // coverage = 6.136612021857923498
            // ctargemaCA = 6.006058244500728287
            expect(await mocImpl.getCglb()).to.be.gte(await mocImpl.calcCtargemaCA());
          });
          it("THEN a 1636.95 TP 1 are redeemed", async function () {
            // i: 1
            // sender: alice
            // receiver: alice
            // qTC: 1507.93 TC
            // qTP: 2500 TP
            // qAC: 1984.12 AC - 8% for Moc Fee Flow
            // qACfee: 8% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[TP_1],
              alice,
              alice,
              pEth("1507.936507936507936183"),
              pEth("2499.999999999999999987"),
              pEth("1825.396825396825396524"),
              pEth("158.730158730158730132"),
              0,
              0,
              0,
              noVendor,
            ]);
          });
        });
      });
    });
  });
};

export { redeemTCandTPBehavior };
