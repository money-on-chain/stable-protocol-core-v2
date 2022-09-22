import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { Balance, ERRORS, pEth, CONSTANTS, mineUpTo } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";
import { expect } from "chai";
import { beforeEach } from "mocha";

const redeemTPBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;
  const { mocFeeFlowAddress, mocInterestCollectorAddress } = mocAddresses["hardhat"];
  const fixedBlock = 85342;

  describe("Feature: redeem Pegged Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ alice, bob } = await getNamedAccounts());
    });

    describe("GIVEN alice has 3000 TC and 100 TP", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 3000 });
        await mocFunctions.mintTP({ i: 0, from: alice, qTP: 100 });
      });
      describe("WHEN alice tries to redeem 0 TP", function () {
        it("THEN tx reverts because the amount of AC is invalid", async function () {
          await expect(mocFunctions.redeemTP({ i: 0, from: alice, qTP: 0 })).to.be.revertedWithCustomError(
            mocContracts.mocImpl,
            ERRORS.INVALID_VALUE,
          );
        });
      });
      describe("WHEN alice tries to redeem 1 TP to the zero address", function () {
        it("THEN tx reverts because recipient is the zero address", async function () {
          await expect(mocFunctions.redeemTPto({ i: 0, from: alice, to: CONSTANTS.ZERO_ADDRESS, qTP: 1 })).to.be
            .reverted;
        });
      });
      describe("WHEN alice tries to redeem 101 TP", function () {
        it("THEN tx reverts because there is not enough TP available to redeem", async function () {
          await expect(mocFunctions.redeemTP({ i: 0, from: alice, qTP: 101 })).to.be.reverted;
        });
      });
      describe("AND alice transfers 50 TP to bob", function () {
        beforeEach(async function () {
          await mocFunctions.tpTransfer({ i: 0, from: alice, to: bob, amount: 50 });
        });
        describe("WHEN alice tries to redeem 51 TP", function () {
          it("THEN tx reverts because alice doesn't have that much TP", async function () {
            await expect(mocFunctions.redeemTP({ i: 0, from: alice, qTP: 51 })).to.be.reverted;
          });
        });
      });
      describe("WHEN alice redeems 100 TP expecting 101 Asset", function () {
        it("THEN tx reverts because Asset received is below the minimum required", async function () {
          await expect(
            mocFunctions.redeemTP({ i: 0, from: alice, qTP: 100, qACmin: 101 }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.QAC_BELOW_MINIMUM);
        });
      });
      describe("WHEN alice redeems 100 TP within the minimum interest payment block", function () {
        /*  
        nAC = 400    
        nTP = 100
        lckAC = 100
        ctarg = 4
        => TP available to redeem = 100

        arb = 1 => fctb = 0.1
        arf = 0 => fctb = 5
        => fctAvg = 2.55
        tils = 1%
        => interest = 1% * 2.55 * (85340/86400) = 2.518%
        */
        let tx: ContractTransaction;
        let alicePrevACBalance: Balance;
        let mocPrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        let mocInterestCollectorPrevACBalance: Balance;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          mocInterestCollectorPrevACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          // go forward to a fixed block remaining for settlement to avoid unpredictability
          const bns = await mocContracts.mocSettlement.bns();
          await mineUpTo(bns.sub(fixedBlock));
          tx = await mocFunctions.redeemTP({ i: 0, from: alice, qTP: 100 });
        });
        it("THEN alice has 0 TP", async function () {
          assertPrec(0, await mocFunctions.tpBalanceOf(0, alice));
        });
        it("THEN Moc balance decrease 100 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          const diff = mocPrevACBalance.sub(mocActualACBalance);
          assertPrec(100, diff);
        });
        it("THEN Moc Fee Flow balance increase 5% of 100 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(100 * 0.05, diff);
        });
        it("THEN Moc Interest Collector balance increase 2.518% of 100 AC", async function () {
          const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
          assertPrec("2.5187152777777777", diff);
        });
        it("THEN alice balance increase 100 Asset - 5% for Moc Fee Flow - 2.518% for Moc Interest Collector", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = aliceActualACBalance.sub(alicePrevACBalance);
          assertPrec("92.4812847222222223", diff);
        });
        it("THEN a TPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: alice || mocWrapper
          // qTP: 100 TP
          // qAC: 100 AC - 5% for Moc Fee Flow - 2.518% for Moc Interest Collector
          // qACfee: 5% AC
          // qACInterest: 2.518%
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPRedeemed")
            .withArgs(
              0,
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || alice,
              pEth(100),
              pEth("92.4812847222222223"),
              pEth(100 * 0.05),
              pEth("2.5187152777777777"),
            );
        });
        it("THEN a Pegged Token Transfer event is emitted", async function () {
          // from: alice || mocWrapper
          // to: Zero Address
          // amount: 100 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[0], "Transfer")
            .withArgs(mocContracts.mocWrapper?.address || alice, CONSTANTS.ZERO_ADDRESS, pEth(100));
        });
      });
      describe("WHEN alice redeems 100 TP to bob within the minimum interest payment block", function () {
        /*  
        nAC = 400    
        nTP = 100
        lckAC = 100
        ctarg = 4
        => TP available to redeem = 100

        arb = 1 => fctb = 0.1
        arf = 0 => fctb = 5
        => fctAvg = 2.55
        tils = 1%
        => interest = 1% * 2.55 * (85340/86400) = 2.518%
        */
        let tx: ContractTransaction;
        let bobPrevACBalance: Balance;
        let mocPrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        let mocInterestCollectorPrevACBalance: Balance;
        beforeEach(async function () {
          bobPrevACBalance = await mocFunctions.assetBalanceOf(bob);
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          mocInterestCollectorPrevACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          // go forward to a fixed block remaining for settlement to avoid unpredictability
          const bns = await mocContracts.mocSettlement.bns();
          await mineUpTo(bns.sub(fixedBlock));
          tx = await mocFunctions.redeemTPto({ i: 0, from: alice, to: bob, qTP: 100 });
        });
        it("THEN alice has 0 TP", async function () {
          assertPrec(0, await mocFunctions.tpBalanceOf(0, alice));
        });
        it("THEN Moc balance decrease 100 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          const diff = mocPrevACBalance.sub(mocActualACBalance);
          assertPrec(100, diff);
        });
        it("THEN Moc Fee Flow balance increase 5% of 100 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(100 * 0.05, diff);
        });
        it("THEN Moc Interest Collector balance increase 2.518% of 100 AC", async function () {
          const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
          assertPrec("2.5187152777777777", diff);
        });
        it("THEN bob balance increase 100 Asset - 5% for Moc Fee Flow - 2.518% for Moc Interest Collector", async function () {
          const bobActualACBalance = await mocFunctions.assetBalanceOf(bob);
          const diff = bobActualACBalance.sub(bobPrevACBalance);
          assertPrec("92.4812847222222223", diff);
        });
        it("THEN a TPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: bob || mocWrapper
          // qTP: 100 TP
          // qAC: 100 AC - 5% for Moc Fee Flow - 2.518% for Moc Interest Collector
          // qACfee: 5% AC
          // qACInterest: 2.518%
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPRedeemed")
            .withArgs(
              0,
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || bob,
              pEth(100),
              pEth("92.4812847222222223"),
              pEth(100 * 0.05),
              pEth("2.5187152777777777"),
            );
        });
      });
      describe("WHEN blocks remaning to settlement are less than minimum interest payment blocks", function () {
        beforeEach(async function () {
          // go forward to a a block near the settlement
          const bns = await mocContracts.mocSettlement.bns();
          const bMin = await mocContracts.mocImpl.tpBmin(0);
          await mineUpTo(bns.sub(bMin));
        });
        describe("AND alice redeems 100 TP after the minimum interest payment block", function () {
          /*  
          nAC = 400    
          nTP = 100
          lckAC = 100
          ctarg = 4
          => TP available to redeem = 100
          => interest = 0%
          */
          let tx: ContractTransaction;
          let mocInterestCollectorPrevACBalance: Balance;
          beforeEach(async function () {
            mocInterestCollectorPrevACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
            tx = await mocFunctions.redeemTP({ i: 0, from: alice, qTP: 100 });
          });
          it("THEN Moc Interest Collector balance didn't increase AC", async function () {
            const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
            const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
            assertPrec(0, diff);
          });
          it("THEN a TPRedeemed event is emitted", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: alice || mocWrapper
            // qTP: 100 TP
            // qAC: 100 AC - 5% for Moc Fee Flow
            // qACfee: 5% AC
            // qACInterest: 0%
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TPRedeemed")
              .withArgs(
                0,
                mocContracts.mocWrapper?.address || alice,
                mocContracts.mocWrapper?.address || alice,
                pEth(100),
                pEth(100 * 0.95),
                pEth(100 * 0.05),
                pEth(0),
              );
          });
        });
      });
      describe("WHEN Collateral Asset relation with Pegged Token price falls to 1/15.5", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(0, "0.064516129032258064");
        });
        describe("WHEN Alice tries to redeem 100 TP", function () {
          /*  
            nAC = 3100    
            nTP = 100
            lckAC = 1550
            => coverage = 2 
        */
          it("THEN tx reverts because coverage is below the protected threshold", async function () {
            await expect(mocFunctions.mintTP({ i: 0, from: alice, qTP: 100 })).to.be.revertedWithCustomError(
              mocContracts.mocImpl,
              ERRORS.LOW_COVERAGE,
            );
          });
        });
      });
    });
  });
};

export { redeemTPBehavior };
