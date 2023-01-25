import hre, { getNamedAccounts } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { beforeEach } from "mocha";
import { assertPrec } from "../helpers/assertHelper";
import { Balance, ERRORS, pEth, CONSTANTS } from "../helpers/utils";
import { getNetworkDeployParams } from "../../scripts/utils";

const redeemTCandTPBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;

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

  describe("Feature: joint Redeem TC and TP operation", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ alice, bob } = await getNamedAccounts());
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
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.INSUFFICIENT_QTP_SENT);
        });
      });
      describe("WHEN alice tries to redeem 0 TC", function () {
        it("THEN tx reverts because the amount of TC is too low and out of precision", async function () {
          await expect(
            mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 0, qTP: 23500 }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO);
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
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.QAC_BELOW_MINIMUM);
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
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.INSUFFICIENT_QTP_SENT);
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
        let tx: ContractTransaction;
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
            mocContracts.mocImpl.getCglb(),
            mocContracts.mocImpl.getPTCac(),
            mocContracts.mocImpl.getLeverageTC(),
            mocFunctions.tcBalanceOf(alice),
            mocFunctions.tpBalanceOf(TP_0, alice),
            mocFunctions.assetBalanceOf(alice),
            mocFunctions.assetBalanceOf(bob),
            mocFunctions.acBalanceOf(mocContracts.mocImpl.address),
            mocFunctions.acBalanceOf(mocFeeFlowAddress),
          ]);
          tx = await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: "783.333333333333333333" });
        });
        it("THEN coverage did not change", async function () {
          assertPrec(coverageBefore, await mocContracts.mocImpl.getCglb());
        });
        it("THEN TC price did not change", async function () {
          assertPrec(tcPriceBefore, await mocContracts.mocImpl.getPTCac());
        });
        it("THEN TC leverage did not change", async function () {
          assertPrec(tcLeverageBefore, await mocContracts.mocImpl.getLeverageTC());
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
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
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
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TCandTPRedeemed")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || alice,
              pEth(100),
              pEth("783.333333333333333333"),
              pEth("95.066666666666666667"),
              pEth("8.266666666666666666"),
              0,
            );
        });
        it("THEN a Collateral Token Transfer event is emitted", async function () {
          // from: alice || mocWrapper
          // to: Zero Address
          // amount: 100 TC
          await expect(tx)
            .to.emit(mocContracts.mocCollateralToken, "Transfer")
            .withArgs(mocContracts.mocWrapper?.address || alice, CONSTANTS.ZERO_ADDRESS, pEth(100));
        });
        it("THEN a Pegged Token Transfer event is emitted", async function () {
          // from: alice || mocWrapper
          // to: Zero Address
          // amount: 783.33 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[TP_0], "Transfer")
            .withArgs(
              mocContracts.mocWrapper?.address || alice,
              CONSTANTS.ZERO_ADDRESS,
              pEth("783.333333333333333333"),
            );
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
        let tx: ContractTransaction;
        beforeEach(async function () {
          [coverageBefore, tcPriceBefore, tcLeverageBefore, bobPrevACBalance] = await Promise.all([
            mocContracts.mocImpl.getCglb(),
            mocContracts.mocImpl.getPTCac(),
            mocContracts.mocImpl.getLeverageTC(),
            mocFunctions.assetBalanceOf(bob),
          ]);
          tx = await mocFunctions.redeemTCandTPto({ i: TP_0, from: alice, to: bob, qTC: 100, qTP: 23500 });
        });
        it("THEN coverage did not change", async function () {
          assertPrec(coverageBefore, await mocContracts.mocImpl.getCglb());
        });
        it("THEN TC price did not change", async function () {
          assertPrec(tcPriceBefore, await mocContracts.mocImpl.getPTCac());
        });
        it("THEN TC leverage did not change", async function () {
          assertPrec(tcLeverageBefore, await mocContracts.mocImpl.getLeverageTC());
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
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TCandTPRedeemed")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || bob,
              pEth(100),
              pEth("783.333333333333333333"),
              pEth("95.066666666666666667"),
              pEth("8.266666666666666666"),
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
          let tx: ContractTransaction;
          beforeEach(async function () {
            [coverageBefore, tcPriceBefore, tcLeverageBefore] = await Promise.all([
              mocContracts.mocImpl.getCglb(),
              mocContracts.mocImpl.getPTCac(),
              mocContracts.mocImpl.getLeverageTC(),
            ]);
            tx = await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500 });
          });
          it("THEN coverage did not change", async function () {
            assertPrec(coverageBefore, await mocContracts.mocImpl.getCglb());
          });
          it("THEN TC price did not change", async function () {
            assertPrec(tcPriceBefore, await mocContracts.mocImpl.getPTCac());
          });
          it("THEN TC leverage did not change", async function () {
            assertPrec(tcLeverageBefore, await mocContracts.mocImpl.getLeverageTC());
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
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TCandTPRedeemed")
              .withArgs(
                TP_0,
                mocContracts.mocWrapper?.address || alice,
                mocContracts.mocWrapper?.address || alice,
                pEth(100),
                pEth("783.333333333333333333"),
                pEth("95.066666666666666667"),
                pEth("8.266666666666666666"),
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
          let tx: ContractTransaction;
          beforeEach(async function () {
            [coverageBefore, tcPriceBefore, tcLeverageBefore] = await Promise.all([
              mocContracts.mocImpl.getCglb(),
              mocContracts.mocImpl.getPTCac(),
              mocContracts.mocImpl.getLeverageTC(),
            ]);
            tx = await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500 });
          });
          it("THEN coverage did not change", async function () {
            assertPrec(coverageBefore, await mocContracts.mocImpl.getCglb(), undefined, 1);
          });
          it("THEN TC price did not change", async function () {
            assertPrec(tcPriceBefore, await mocContracts.mocImpl.getPTCac());
          });
          it("THEN TC leverage did not change", async function () {
            assertPrec(tcLeverageBefore, await mocContracts.mocImpl.getLeverageTC());
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
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TCandTPRedeemed")
              .withArgs(
                TP_0,
                mocContracts.mocWrapper?.address || alice,
                mocContracts.mocWrapper?.address || alice,
                pEth(100),
                pEth(1175),
                pEth("94.913333333333333272"),
                pEth("8.253333333333333328"),
                0,
              );
          });
        });
      });
      describe("AND Pegged Token has been revaluated making lckAC bigger than total AC in the protocol", function () {
        // this test is to check that tx doesn´t fail because underflow doing totalACAvailable - lckAC
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, "0.00000001");
        });
        it("THEN tx reverts because coverage is below the protected threshold", async function () {
          expect((await mocContracts.mocImpl.getCglb()) < pEth(1)); // check that lckAC > totalACAvailable
          await expect(
            mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500 }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.LOW_COVERAGE);
        });
      });
    });
  });
};

export { redeemTCandTPBehavior };
