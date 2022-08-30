import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { Balance, ERRORS, pEth, CONSTANTS } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";
import { expect } from "chai";

const mintTPBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  const mocFeeFlow = mocAddresses["hardhat"].mocFeeFlowAddress;

  describe("Feature: mint Pegged Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ deployer, alice, bob } = await getNamedAccounts());
    });
    describe("WHEN alice sends 0 Asset to mint TP", function () {
      it("THEN tx reverts because the amount of AC is invalid", async function () {
        await expect(mocFunctions.mintTP({ i: 0, from: alice, qTP: 0 })).to.be.revertedWithCustomError(
          mocContracts.mocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN alice sends 100 Asset to mint 100 TP but there is not collateral in the protocol", function () {
      it("THEN tx reverts because there is not enough TP to mint", async function () {
        await expect(mocFunctions.mintTP({ i: 0, from: alice, qTP: 100 })).to.be.revertedWithCustomError(
          mocContracts.mocImpl,
          ERRORS.INSUFFICIENT_TP_TO_MINT,
        );
      });
    });
    describe("GIVEN 3000 Asset as collateral in the protocol", function () {
      /*  
        nAC = 3000    
        nTP = 0
        lckAC = 0
        ctarg = 4
        => TP available to mint = 1000
        */
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: deployer, qTC: 3000 });
      });
      describe("WHEN alice sends 100 Asset to mint 100 TP to the zero address", function () {
        it("THEN tx reverts because recipient is the zero address", async function () {
          await expect(
            mocFunctions.mintTPto({ i: 0, from: alice, to: CONSTANTS.ZERO_ADDRESS, qTP: 100 }),
          ).to.be.revertedWith(ERRORS.MINT_TO_ZERO_ADDRESS);
        });
      });
      describe("WHEN alice sends 10 Asset to mint 100 TP", function () {
        it("THEN tx reverts because the amount of AC is insufficient", async function () {
          await expect(mocFunctions.mintTP({ i: 0, from: alice, qTP: 100, qACmax: 10 })).to.be.revertedWithCustomError(
            mocContracts.mocImpl,
            ERRORS.INSUFFICIENT_QAC_SENT,
          );
        });
      });
      describe("WHEN alice sends 105(exactly amount) Asset to mint 100 TP", function () {
        let tx: ContractTransaction;
        let alicePrevACBalance: Balance;
        let mocPrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          tx = await mocFunctions.mintTP({ i: 0, from: alice, qTP: 100, qACmax: 105 });
        });
        it("THEN alice receives 100 TP", async function () {
          assertPrec(100, await mocFunctions.tpBalanceOf(0, alice));
        });
        it("THEN Moc balance increase 100 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          const diff = mocActualACBalance.sub(mocPrevACBalance);
          assertPrec(100, diff);
        });
        it("THEN Moc Fee Flow balance increase 5% of 100 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(100 * 0.05, diff);
        });
        it("THEN alice balance decrease 100 Asset + 5% for Moc Fee Flow", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec(100 * 1.05, diff);
        });
        it("THEN a TPMinted event is emmited", async function () {
          // sender: alice || mocWrapper
          // receiver: alice
          // qTP: 100 TP
          // qAC: 100 AC + 5% for Moc Fee Flow
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPMinted")
            .withArgs(mocContracts.mocWrapper?.address || alice, alice, pEth(100), pEth(100 * 1.05));
        });
        describe("AND alice tries to mint 901 TP more", function () {
          /*  
            nAC = 3100    
            nTP = 100
            lckAC = 100
            ctarg = 4
            => TP available to mint = 900
        */
          it("THEN tx reverts because there is not enough TP to mint", async function () {
            await expect(mocFunctions.mintTP({ i: 0, from: alice, qTP: 901 })).to.be.revertedWithCustomError(
              mocContracts.mocImpl,
              ERRORS.INSUFFICIENT_TP_TO_MINT,
            );
          });
        });
        describe("AND alice sends 1000(exceeded amount) Asset to mint 100 TP", function () {
          /*  
            nAC = 3100    
            nTP = 100
            lckAC = 100
            ctarg = 4
            => TP available to mint = 900
        */
          let alicePrevACBalance: Balance;
          let alicePrevTPBalance: Balance;
          let mocPrevACBalance: Balance;
          let mocFeeFlowPrevACBalance: Balance;
          beforeEach(async function () {
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            alicePrevTPBalance = await mocFunctions.tpBalanceOf(0, alice);
            mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
            mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
            await mocFunctions.mintTP({ i: 0, from: alice, qTP: 100 });
          });
          it("THEN alice receives 100 TP", async function () {
            const aliceActualTPBalance = await mocFunctions.tpBalanceOf(0, alice);
            const diff = aliceActualTPBalance.sub(alicePrevTPBalance);
            assertPrec(100, diff);
          });
          it("THEN Moc balance increase 100 AC", async function () {
            const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
            const diff = mocActualACBalance.sub(mocPrevACBalance);
            assertPrec(100, diff);
          });
          it("THEN Moc Fee Flow balance increase 5% of 100 AC", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
            const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
            assertPrec(100 * 0.05, diff);
          });
          it("THEN alice balance decrease 100 Asset + 5% for Moc Fee Flow", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = alicePrevACBalance.sub(aliceActualACBalance);
            assertPrec(100 * 1.05, diff);
          });
        });
      });
      describe("WHEN alice sends 105 Asset to mint 100 TP to bob", function () {
        /*  
          nAC = 3000    
          nTP = 0
          lckAC = 0
          ctarg = 4
          => TP available to mint = 1000
        */
        let tx: ContractTransaction;
        let alicePrevACBalance: Balance;
        let mocPrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          tx = await mocFunctions.mintTPto({ i: 0, from: alice, to: bob, qTP: 100 });
        });
        it("THEN bob receives 100 TP", async function () {
          assertPrec(100, await mocFunctions.tpBalanceOf(0, bob));
        });
        it("THEN Moc balance increase 100 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          const diff = mocActualACBalance.sub(mocPrevACBalance);
          assertPrec(100, diff);
        });
        it("THEN Moc Fee Flow balance increase 5% of 100 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(100 * 0.05, diff);
        });
        it("THEN alice balance decrease 100 Asset + 5% for Moc Fee Flow", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec(100 * 1.05, diff);
        });
        it("THEN a TPMinted event is emmited", async function () {
          // sender: alice || mocWrapper
          // receiver: bob
          // qTP: 100 TP
          // qAC: 100 AC + 5% for Moc Fee Flow
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPMinted")
            .withArgs(mocContracts.mocWrapper?.address || alice, bob, pEth(100), pEth(100 * 1.05));
        });
      });
    });
  });
};

export { mintTPBehavior };
