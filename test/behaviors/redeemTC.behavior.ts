import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { Balance, ERRORS, pEth, CONSTANTS } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";
import { expect } from "chai";

const redeemTCBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  const mocFeeFlow = mocAddresses["hardhat"].mocFeeFlowAddress;

  describe("Feature: redeem Collateral Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ deployer, alice, bob } = await getNamedAccounts());
    });
    describe("GIVEN alice has 300 TC", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 300 });
      });
      describe("WHEN alice tries to redeem 0 TC", function () {
        it("THEN tx reverts because the amount of AC is invalid", async function () {
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
      describe("AND 10 TP are minted", function () {
        beforeEach(async function () {
          await mocFunctions.mintTP({ i: 0, from: deployer, qTP: 10 });
        });
        /*  
        nAC = 310   
        nTP = 10
        lckAC = 10
        ctarg = 5
        => TC available to redeem = 260
        */
        describe("WHEN alice tries to redeem 261 TC", function () {
          it("THEN tx reverts because there is not enough TC available to redeem", async function () {
            await expect(mocFunctions.redeemTC({ from: alice, qTC: 261 })).to.be.revertedWithCustomError(
              mocContracts.mocImpl,
              ERRORS.INSUFFICIENT_TC_TO_REDEEM,
            );
          });
        });
        describe("WHEN alice redeems 260 TC", function () {
          let alicePrevACBalance: Balance;
          beforeEach(async function () {
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            await mocFunctions.redeemTC({ from: alice, qTC: 260 });
          });
          it("THEN alice balance decrease 260 TC", async function () {
            assertPrec(40, await mocFunctions.tcBalanceOf(alice));
          });
          it("THEN alice balance increase 260 Asset - 5% for Moc Fee Flow", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = aliceActualACBalance.sub(alicePrevACBalance);
            assertPrec(260 * 0.95, diff);
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
                mocContracts.mocImpl,
                ERRORS.LOW_COVERAGE,
              );
            });
          });
        });
      });
    });
  });
};

export { redeemTCBehavior };
