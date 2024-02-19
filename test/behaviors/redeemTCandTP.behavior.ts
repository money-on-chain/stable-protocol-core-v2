import hre, { getNamedAccounts, ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { beforeEach } from "mocha";
import { assertPrec } from "../helpers/assertHelper";
import { Balance, ERRORS, pEth, CONSTANTS, expectEventFor, getNetworkDeployParams } from "../helpers/utils";
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
  const noVendor = CONSTANTS.ZERO_ADDRESS;
  const TP_0 = 0;
  const TP_1 = 1;
  const TP_4 = 4;
  const {
    mocAddresses: { mocFeeFlowAddress },
    queueParams: {
      execFeeParams: { redeemTCandTPExecFee },
    },
  } = getNetworkDeployParams(hre);

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

  let getCglbRelation: () => Promise<Balance>;

  describe("Feature: joint Redeem TC and TP operation", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ mocImpl } = mocContracts);
      ({ alice, bob, vendor } = await getNamedAccounts());
      expectEvent = expectEventFor(mocContracts, "TCandTPRedeemed");
      assertACResult = mocFunctions.assertACResult(-redeemTCandTPExecFee);
      tps = mocContracts.mocPeggedTokens.map((it: any) => it.address);

      getCglbRelation = async () => {
        const cglb = (await mocImpl.getCglb()).sub(pEth(1));
        const ctargema = (await mocImpl.calcCtargemaCA()).sub(pEth(1));
        return cglb.mul(pEth(1)).div(ctargema);
      };
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
      describe("WHEN alice redeems 100 TC and 5175 TP expecting 95.06 Asset", function () {
        it("THEN tx reverts because Asset received is below the minimum required", async function () {
          await expect(
            mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 5175, qACmin: "95.066666666666666668" }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.QAC_BELOW_MINIMUM);
        });
      });
      describe("WHEN alice redeems 1000 TC and 783.32 TP (less amount of TP)", function () {
        /*
          coverage = 31
          ctargemaCA = 5.54
          ctargemaTP = 5.54
          redeemProportion = (31 - 1) * (5.54 - 1) / (5.54 - 1) = 30
          qTP = (100 * 235 * 1) / 30 = 783.33 TP0
        */
        it("THEN tx reverts because sent insufficient amount of TP", async function () {
          await expect(
            mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: "783.333333333333333332" }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.INSUFFICIENT_QTP_SENT);
        });
      });
      describe("WHEN alice redeems 100 TC and 783.33 TP (exactly amount of TP)", function () {
        /*
          coverage = 31
          ctargemaCA = 5.54
          ctargemaTP = 5.54
          redeemProportion = (31 - 1) * (5.54 - 1) / (5.54 - 1) = 30
          qTP = (100 * 235 * 1) / 30 = 783.33 TP0
          => AC redeemed = 100 AC - 8% + 3.333AC - 8% = 95.06
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
          tx = await mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: "783.333333333333333333" });
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
        it("THEN alice AC balance increase 95.06 AC", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = aliceActualACBalance.sub(alicePrevACBalance);
          assertACResult("95.066666666666666667", diff);
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
          // sender: alice
          // receiver: alice
          // qTC: 100 TC
          // qTP: 783.33 TP
          // qAC: 103.33 AC - 8% for Moc Fee Flow
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[TP_0],
            alice,
            alice,
            pEth(100),
            pEth("783.333333333333333333"),
            pEth("95.066666666666666667"),
            pEth("8.266666666666666666"),
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
          // amount: 783.33 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[TP_0], "Transfer")
            .withArgs(mocImpl.address, CONSTANTS.ZERO_ADDRESS, pEth("783.333333333333333333"));
        });
      });
      describe("WHEN alice redeems 100 TC and 23500 TP (more amount of TP) to bob", function () {
        /*
          coverage = 31
          ctargemaCA = 5.54
          ctargemaTP = 5.54
          redeemProportion = (31 - 1) * (5.54 - 1) / (5.54 - 1) = 30
          qTP = (100 * 235 * 1) / 30 = 783.33 TP0
          => AC redeemed = 100 AC - 8% + 3.333AC - 8% = 95.06
        */
        beforeEach(async function () {
          bobPrevACBalance = await mocFunctions.assetBalanceOf(bob);
          tx = await mocFunctions.redeemTCandTP({ from: alice, to: bob, qTC: 100, qTP: 23500 });
        });
        it("THEN bob AC balance increase 95.06 AC", async function () {
          const bobActualACBalance = await mocFunctions.assetBalanceOf(bob);
          const diff = bobActualACBalance.sub(bobPrevACBalance);
          assertPrec("95.066666666666666667", diff);
        });
        it("THEN a TCandTPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice
          // receiver: bob
          // qTC: 100 TC
          // qTP: 783.33 TP
          // qAC: 103.33 AC - 8% for Moc Fee Flow
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[TP_0],
            alice,
            bob,
            pEth(100),
            pEth("783.333333333333333333"),
            pEth("95.066666666666666667"),
            pEth("8.266666666666666666"),
            0,
            0,
            0,
            noVendor,
          ]);
        });
      });
      describe("WHEN alice redeems 100 TC and 783.33 TP via vendor", function () {
        let alicePrevACBalance: Balance;
        let vendorPrevACBalance: Balance;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          vendorPrevACBalance = await mocFunctions.acBalanceOf(vendor);
          tx = await mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 23500, vendor });
        });
        it("THEN alice AC balance increase 84.73 Asset (103.33 qAC - 8% qACFee - 10% qACVendorMarkup)", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = aliceActualACBalance.sub(alicePrevACBalance);
          assertACResult("84.733333333333333334", diff);
        });
        it("THEN vendor AC balance increase 10.33 Asset", async function () {
          const vendorActualACBalance = await mocFunctions.acBalanceOf(vendor);
          const diff = vendorActualACBalance.sub(vendorPrevACBalance);
          assertPrec("10.333333333333333333", diff);
        });
        it("THEN a TCandTPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice
          // receiver: alice
          // qTC: 100 TC
          // qTP: 783.33 TP
          // qAC: 103.33 AC - 8% for Moc Fee Flow - 10% for vendor
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 10.33
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[TP_0],
            alice,
            alice,
            pEth(100),
            pEth("783.333333333333333333"),
            pEth("84.733333333333333334"),
            pEth("8.266666666666666666"),
            0,
            pEth("10.333333333333333333"),
            0,
            vendor,
          ]);
        });
      });
      describe("WHEN alice redeems 100 TC and 783.33 TP to bob via vendor", function () {
        beforeEach(async function () {
          tx = await mocFunctions.redeemTCandTP({ from: alice, to: bob, qTC: 100, qTP: 23500, vendor });
        });
        it("THEN a TCandTPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice
          // receiver: bob
          // qTC: 100 TC
          // qTP: 783.33 TP
          // qAC: 103.33 AC - 8% for Moc Fee Flow - 10% for vendor
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 10.33
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[TP_0],
            alice,
            bob,
            pEth(100),
            pEth("783.333333333333333333"),
            pEth("84.733333333333333334"),
            pEth("8.266666666666666666"),
            0,
            pEth("10.333333333333333333"),
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
            redeemProportion = (1.319 - 1) * (5 - 1) / (5 - 1) = 0.319
            qTP = (100 * 10 * 0.25) / 0.319 = 783,33 TP0
            => AC redeemed = 25 AC - 8% + 78.33AC - 8% = 95.066
          */
          beforeEach(async function () {
            [coverageBefore, tcLeverageBefore] = await Promise.all([mocImpl.getCglb(), mocImpl.getLeverageTC()]);
            tx = await mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 23500 });
          });
          it("THEN coverage did not change", async function () {
            assertPrec(await mocImpl.getCglb(), coverageBefore);
          });
          it("THEN TC leverage did not change", async function () {
            assertPrec(await mocImpl.getLeverageTC(), tcLeverageBefore);
          });
          it("THEN a TCandTPRedeemed event is emitted", async function () {
            // i: 0
            // sender: alice
            // receiver: alice
            // qTC: 100 TC
            // qTP: 783.33 TP
            // qAC: 103.33 AC - 8% for Moc Fee Flow
            // qACfee: 8% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[TP_0],
              alice,
              alice,
              pEth(100),
              pEth("783.333333333333335683"),
              pEth("95.066666666666666883"),
              pEth("8.266666666666666685"),
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
            redeemProportion = (41.26 - 1) * (11.08 - 1) / (11.08 - 1) = 40.26
            qTP = (100 * 470 * 1.0066) / (40.26) = 1174.99 TP0
            => AC redeemed = 100.66 AC - 8% + 2.5AC - 8% = 94.91
          */
          beforeEach(async function () {
            [coverageBefore, tcLeverageBefore] = await Promise.all([mocImpl.getCglb(), mocImpl.getLeverageTC()]);
            tx = await mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 23500 });
          });
          it("THEN coverage did not change", async function () {
            assertPrec(await mocImpl.getCglb(), coverageBefore, undefined, 1);
          });
          it("THEN TC leverage did not change", async function () {
            assertPrec(await mocImpl.getLeverageTC(), tcLeverageBefore);
          });
          it("THEN a TCandTPRedeemed event is emitted", async function () {
            // i: 0
            // sender: alice
            // receiver: alice
            // qTC: 100 TC
            // qTP: 1174.99 TP
            // qAC: 103.16 AC - 8% for Moc Fee Flow
            // qACfee: 8% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[TP_0],
              alice,
              alice,
              pEth(100),
              pEth("1174.999999999999999241"),
              pEth("94.913333333333333271"),
              pEth("8.253333333333333327"),
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
        describe("WHEN alice redeems 100 TC and 783.33 TP", function () {
          let alicePrevACBalance: Balance;
          beforeEach(async function () {
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            tx = await mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 23500 });
          });
          it("THEN alice AC balance increase 103.33 Asset", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = aliceActualACBalance.sub(alicePrevACBalance);
            assertACResult("103.333333333333333333", diff);
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
            // sender: alice
            // receiver: alice
            // qTC: 100 TC
            // qTP: 783.33 TP
            // qAC: 103.33 AC
            // qACfee: 0 AC
            // qFeeToken: 4.13 (8% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[TP_0],
              alice,
              alice,
              pEth(100),
              pEth("783.333333333333333333"),
              pEth("103.333333333333333333"),
              0,
              pEth("4.133333333333333333"),
              0,
              0,
              noVendor,
            ]);
          });
        });
        describe("WHEN alice redeems 100 TC and 783.33 TP to bob", function () {
          let bobPrevACBalance: Balance;
          beforeEach(async function () {
            bobPrevACBalance = await mocFunctions.assetBalanceOf(bob);
            tx = await mocFunctions.redeemTCandTP({ from: alice, to: bob, qTC: 100, qTP: 23500 });
          });
          it("THEN bob AC balance increase 103.33 Asset", async function () {
            const bobActualACBalance = await mocFunctions.assetBalanceOf(bob);
            const diff = bobActualACBalance.sub(bobPrevACBalance);
            assertPrec("103.333333333333333333", diff);
          });
          it("THEN Fee Token is used as fee payment method", async function () {
            // i: 0
            // sender: alice
            // receiver: bob
            // qTC: 100 TC
            // qTP: 783.33 TP
            // qAC: 103.33 AC
            // qACfee: 0 AC
            // qFeeToken: 4.13 (8% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[TP_0],
              alice,
              bob,
              pEth(100),
              pEth("783.333333333333333333"),
              pEth("103.333333333333333333"),
              0,
              pEth("4.133333333333333333"),
              0,
              0,
              noVendor,
            ]);
          });
        });
      });
      describe("WHEN alice redeems all", function () {
        beforeEach(async function () {
          await mocFunctions.redeemTCandTP({ from: alice, qTC: 3000, qTP: 23500 });
        });
        it("THEN coverage is max uint256", async function () {
          assertPrec(await mocImpl.getCglb(), CONSTANTS.MAX_UINT256);
        });
        it("THEN ctargemaCA is 4", async function () {
          assertPrec(await mocImpl.calcCtargemaCA(), 4);
        });
      });
      describe("AND alice has TP 1 and TP 4", function () {
        let cglbRelationBefore: Balance;
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
            // redeemProportion = (4.91 - 1) * (6.25 - 1) / (4.86 - 1) = 5.31
            // qTP = (100 * 5.25 * 1) / 5.31 = 98.87 TP4
            // => AC redeemed = 100 AC - 8% + 18.83AC - 8% = 109.3
            cglbRelationBefore = await getCglbRelation();
            tx = await mocFunctions.redeemTCandTP({ i: TP_4, from: alice, qTC: 100, qTP: 1000 });
          });
          it("THEN relation between combined coverage and combined ctargemaCA remains the same", async function () {
            assertPrec(cglbRelationBefore, await getCglbRelation(), undefined, 1);
          });
          it("THEN a 98.73 TP 4 are redeemed", async function () {
            // i: 4
            // sender: alice
            // receiver: alice
            // qTC: 100 TC
            // qTP: 98.73 TP
            // qAC: 118.8 AC - 8% for Moc Fee Flow
            // qACfee: 8% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[TP_4],
              alice,
              alice,
              pEth(100),
              pEth("98.735907870033506694"),
              pEth("109.302292426748728792"),
              pEth("9.504547167543367721"),
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
            // redeemProportion = (4.91 - 1) * (4.166 - 1) / (4.86 - 1) = 3.2
            // qTP = (100 * 5.25 * 1) / 3.2 = 163.69 TP1
            // => AC redeemed = 100 AC - 8% + 31.17AC - 8% = 120.67
            cglbRelationBefore = await getCglbRelation();
            tx = await mocFunctions.redeemTCandTP({ i: TP_1, from: alice, qTC: 100, qTP: 2500 });
          });
          it("THEN relation between combined coverage and combined ctargemaCA remains the same", async function () {
            assertPrec(cglbRelationBefore, await getCglbRelation(), undefined, 1);
          });
          it("THEN a 1636.95 TP 1 are redeemed", async function () {
            // i: 1
            // sender: alice
            // receiver: alice
            // qTC: 100 TC
            // qTP: 2500 TP
            // qAC: 131.17 AC - 8% for Moc Fee Flow
            // qACfee: 8% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[TP_1],
              alice,
              alice,
              pEth(100),
              pEth("163.693741995055550615"),
              pEth("120.685379549609734584"),
              pEth("10.494380830400846485"),
              0,
              0,
              0,
              noVendor,
            ]);
          });
        });
        describe("AND TP 0 revalues to 10 making protocol to be in low coverage", function () {
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, 10);
            cglbRelationBefore = await getCglbRelation();
            // assert coverage is below ctargemaCA before the operation
            expect(await mocImpl.getCglb()).to.be.lt(await mocImpl.calcCtargemaCA());
          });
          describe("WHEN alice redeems max amount of TP0", function () {
            beforeEach(async function () {
              tx = await mocFunctions.redeemTCandTP({
                i: TP_0,
                from: alice,
                qTC: "2368.168488403092505000",
                qTP: 23500,
              });
            });
            it("THEN relation between combined coverage and combined ctargemaCA remains the same", async function () {
              assertPrec(cglbRelationBefore, await getCglbRelation(), undefined, 1);
            });
          });
          describe("WHEN alice redeems max amount of TP1", function () {
            beforeEach(async function () {
              tx = await mocFunctions.redeemTCandTP({ i: TP_1, from: alice, qTC: "379.898693681684881000", qTP: 2500 });
            });
            it("THEN relation between combined coverage and combined ctargemaCA remains the same", async function () {
              assertPrec(cglbRelationBefore, await getCglbRelation(), undefined, 1);
            });
          });
          describe("WHEN alice redeems max amount of TP4", function () {
            beforeEach(async function () {
              tx = await mocFunctions.redeemTCandTP({ i: TP_4, from: alice, qTC: "251.932817915222606000", qTP: 1000 });
            });
            it("THEN relation between combined coverage and combined ctargemaCA remains the same", async function () {
              assertPrec(cglbRelationBefore, await getCglbRelation(), undefined, 1);
            });
          });
        });
      });
    });
  });
};

export { redeemTCandTPBehavior };
