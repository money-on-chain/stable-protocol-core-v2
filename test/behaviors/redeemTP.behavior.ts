import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { Balance, ERRORS, pEth, CONSTANTS, mineUpTo } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";
import { expect } from "chai";

const redeemTPBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;
  const TP_2 = 2;
  const TP_NON_EXISTENT = 5;

  const { mocFeeFlowAddress, mocInterestCollectorAddress } = mocAddresses["hardhat"];
  const fixedBlock = 85342;

  describe("Feature: redeem Pegged Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ alice, bob } = await getNamedAccounts());
    });

    describe("GIVEN alice has 3000 TC, 23500 TP 0 and 93458 TP 2", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 3000 });
        await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500 });
        await mocFunctions.mintTP({ i: TP_2, from: alice, qTP: 93458 });
      });
      describe("AND TP price provider is deprecated", function () {
        beforeEach(async function () {
          await mocContracts.priceProviders[TP_0].deprecatePriceProvider();
        });
        describe("WHEN alice tries to redeem 23500 TP", function () {
          it("THEN tx reverts because invalid price provider", async function () {
            await expect(mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: 23500 })).to.be.revertedWithCustomError(
              mocContracts.mocImpl,
              ERRORS.INVALID_PRICE_PROVIDER,
            );
          });
        });
      });
      describe("WHEN alice tries to redeem a non-existent TP", function () {
        it("THEN tx reverts with panice code 0x32 array out of bounded", async function () {
          // generic revert because on collateralbag implementation fail before accessing the tp array
          await expect(mocFunctions.redeemTP({ i: TP_NON_EXISTENT, from: alice, qTP: 100 })).to.be.reverted;
        });
      });
      describe("WHEN alice tries to redeem 0 TP", function () {
        it("THEN tx reverts because the amount of AC is invalid", async function () {
          await expect(mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: 0 })).to.be.revertedWithCustomError(
            mocContracts.mocImpl,
            ERRORS.INVALID_VALUE,
          );
        });
      });
      describe("WHEN alice tries to redeem 1 TP to the zero address", function () {
        it("THEN tx reverts because recipient is the zero address", async function () {
          await expect(mocFunctions.redeemTPto({ i: TP_0, from: alice, to: CONSTANTS.ZERO_ADDRESS, qTP: 1 })).to.be
            .reverted;
        });
      });
      describe("WHEN alice tries to redeem 1 wei TP", function () {
        it("THEN tx reverts because the amount of TP is too low and out of precision", async function () {
          await expect(
            mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: 1, applyPrecision: false }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO);
        });
      });
      describe("WHEN alice tries to redeem 23501 TP", function () {
        it("THEN tx reverts because there is not enough TP available to redeem", async function () {
          await expect(mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: 23501 })).to.be.reverted;
        });
      });
      describe("AND alice transfers 50 TP to bob", function () {
        beforeEach(async function () {
          await mocFunctions.tpTransfer({ i: TP_0, from: alice, to: bob, amount: 50 });
        });
        describe("WHEN alice tries to redeem 51 TP", function () {
          it("THEN tx reverts because alice doesn't have that much TP", async function () {
            await expect(mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: 23451 })).to.be.reverted;
          });
        });
      });
      describe("WHEN alice redeems 23500 TP expecting 101 Asset", function () {
        it("THEN tx reverts because Asset received is below the minimum required", async function () {
          await expect(
            mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: 23500, qACmin: 101 }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.QAC_BELOW_MINIMUM);
        });
      });
      describe("WHEN alice redeems 23500 TP within the minimum interest payment block. nTP == qTP so, fct = facMin", function () {
        /*  
        nAC = 3100    
        nTP = 23500
        lckAC = 100
        ctarg = 5.54
        => TP available to redeem = 23500

        arb = 1 => fctb = 0.1
        arf = 1 => fctb = 0.1
        => fctAvg = 0.1
        tils = 1%
        => interest = 1% * 0.1 * (85340/86400) = 0.0987%
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
          tx = await mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: 23500 });
        });
        it("THEN alice has 0 TP", async function () {
          assertPrec(0, await mocFunctions.tpBalanceOf(TP_0, alice));
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
        it("THEN Moc Interest Collector balance increase 0.0987% of 100 AC", async function () {
          const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
          assertPrec("0.098773148148148100", diff);
        });
        it("THEN alice balance increase 100 Asset - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = aliceActualACBalance.sub(alicePrevACBalance);
          assertPrec("94.901226851851851900", diff);
        });
        it("THEN a TPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: alice || mocWrapper
          // qTP: 23500 TP
          // qAC: 100 AC - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector
          // qACfee: 5% AC
          // qACInterest: 0.0987%
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPRedeemed")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || alice,
              pEth(23500),
              pEth("94.901226851851851900"),
              pEth(100 * 0.05),
              pEth("0.098773148148148100"),
            );
        });
        it("THEN a Pegged Token Transfer event is emitted", async function () {
          // from: alice || mocWrapper
          // to: Zero Address
          // amount: 23500 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[TP_0], "Transfer")
            .withArgs(mocContracts.mocWrapper?.address || alice, CONSTANTS.ZERO_ADDRESS, pEth(23500));
        });
      });
      describe("WHEN alice redeems 23500 TP to bob within the minimum interest payment block", function () {
        /*  
        nAC = 3100    
        nTP = 23500
        lckAC = 100
        ctarg = 5.54
        => TP available to redeem = 23500

        arb = 1 => fctb = 0.1
        arf = 1 => fctb = 0.1
        => fctAvg = 0.1
        tils = 1%
        => interest = 1% * 0.1 * (85340/86400) = 0.0987%
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
          tx = await mocFunctions.redeemTPto({ i: TP_0, from: alice, to: bob, qTP: 23500 });
        });
        it("THEN alice has 0 TP", async function () {
          assertPrec(0, await mocFunctions.tpBalanceOf(TP_0, alice));
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
        it("THEN Moc Interest Collector balance increase 0.0987% of 100 AC", async function () {
          const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
          assertPrec("0.098773148148148100", diff);
        });
        it("THEN bob balance increase 100 Asset - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector", async function () {
          const bobActualACBalance = await mocFunctions.assetBalanceOf(bob);
          const diff = bobActualACBalance.sub(bobPrevACBalance);
          assertPrec("94.901226851851851900", diff);
        });
        it("THEN a TPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: bob || mocWrapper
          // qTP: 23500 TP
          // qAC: 100 AC - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector
          // qACfee: 5% AC
          // qACInterest: 0.0987%
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPRedeemed")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || bob,
              pEth(23500),
              pEth("94.901226851851851900"),
              pEth(100 * 0.05),
              pEth("0.098773148148148100"),
            );
        });
      });
      describe("WHEN alice redeems 2350 TP within the minimum interest payment block. nTP != qTP, so fct is calculated", function () {
        /* 
        arb = 1 => fctb = 0.1
        arf = 1 => fctb = 0.1
        => fctAvg = 0.1
        tils = 1%
        => interest = 1% * 0.1 * (85340/86400) = 0.0987%
        */
        let tx: ContractTransaction;
        let mocInterestCollectorPrevACBalance: Balance;
        beforeEach(async function () {
          // go forward to a a block near the settlement
          const bns = await mocContracts.mocSettlement.bns();
          await mineUpTo(bns.sub(fixedBlock));
          mocInterestCollectorPrevACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          tx = await mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: 2350 });
        });
        it("THEN Moc Interest Collector balance increase 0.0987% of 10 AC", async function () {
          const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
          assertPrec("0.009877314814814810", diff);
        });
        it("THEN a TPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: alice || mocWrapper
          // qTP: 2350 TP
          // qAC: 10 AC - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector
          // qACfee: 5% AC
          // qACInterest: 0%
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPRedeemed")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || alice,
              pEth(2350),
              pEth("9.490122685185185190"),
              pEth(10 * 0.05),
              pEth("0.009877314814814810"),
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
        describe("AND alice redeems 23500 TP after the minimum interest payment block", function () {
          /*  
          nAC = 3100    
          nTP = 23500
          lckAC = 100
          ctarg = 5.54
          => TP available to redeem = 23500
          => interest = 0%
          */
          let tx: ContractTransaction;
          let mocInterestCollectorPrevACBalance: Balance;
          beforeEach(async function () {
            mocInterestCollectorPrevACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
            tx = await mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: 23500 });
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
            // qTP: 23500 TP
            // qAC: 100 AC - 5% for Moc Fee Flow
            // qACfee: 5% AC
            // qACInterest: 0%
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TPRedeemed")
              .withArgs(
                TP_0,
                mocContracts.mocWrapper?.address || alice,
                mocContracts.mocWrapper?.address || alice,
                pEth(23500),
                pEth(100 * 0.95),
                pEth(100 * 0.05),
                pEth(0),
              );
          });
        });
      });
      describe("WHEN alice redeems 9345.8 TP 2, which facMin is equal to 0", function () {
        let tx: ContractTransaction;
        let mocInterestCollectorPrevACBalance: Balance;
        beforeEach(async function () {
          // go forward to a a block near the settlement
          const bns = await mocContracts.mocSettlement.bns();
          await mineUpTo(bns.sub(fixedBlock));
          mocInterestCollectorPrevACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          tx = await mocFunctions.redeemTP({ i: TP_2, from: alice, qTP: 9345.8 });
        });
        it("THEN Moc Interest Collector balance didn't increase AC", async function () {
          const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
          assertPrec(0, diff);
        });
        it("THEN a TPRedeemed event is emitted", async function () {
          // i: 2
          // sender: alice || mocWrapper
          // receiver: alice || mocWrapper
          // qTP: 9345.8 TP
          // qAC: 10 AC - 5% for Moc Fee Flow
          // qACfee: 5% AC
          // qACInterest: 0%
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPRedeemed")
            .withArgs(
              TP_2,
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || alice,
              pEth(9345.8),
              pEth(10 * 0.95),
              pEth(10 * 0.05),
              pEth(0),
            );
        });
      });
      describe("WHEN Collateral Asset relation with Pegged Token price falls to 15.1", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, "15.1");
        });
        describe("WHEN Alice tries to redeem 100 TP", function () {
          /*  
            nAC = 3100    
            nTP = 23500
            lckAC = 1556
            => coverage = 2 
        */
          it("THEN tx reverts because coverage is below the protected threshold", async function () {
            await expect(mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 100 })).to.be.revertedWithCustomError(
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
