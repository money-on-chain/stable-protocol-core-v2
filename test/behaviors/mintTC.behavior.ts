import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { Balance, ERRORS, pEth, CONSTANTS, mineUpTo } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";
import { expect } from "chai";

const mintTCBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;
  const mocFeeFlow = mocAddresses["hardhat"].mocFeeFlowAddress;

  describe("Feature: mint Collateral Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ deployer, alice, bob } = await getNamedAccounts());
    });
    describe("WHEN alice sends 0 Asset to mint TC", function () {
      it("THEN tx reverts because the amount of AC is invalid", async function () {
        await expect(mocFunctions.mintTC({ from: alice, qTC: 0 })).to.be.revertedWithCustomError(
          mocContracts.mocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN alice sends 10 Asset to mint 100 TC", function () {
      it("THEN tx reverts because the amount of AC is insufficient", async function () {
        await expect(mocFunctions.mintTC({ from: alice, qTC: 100, qACmax: 10 })).to.be.revertedWithCustomError(
          mocContracts.mocImpl,
          ERRORS.INSUFFICIENT_QAC_SENT,
        );
      });
    });
    describe("WHEN alice sends 100 Asset to mint 100 TC to the zero address", function () {
      it("THEN tx reverts because recipient is the zero address", async function () {
        await expect(mocFunctions.mintTCto({ from: alice, to: CONSTANTS.ZERO_ADDRESS, qTC: 100 })).to.be.revertedWith(
          ERRORS.MINT_TO_ZERO_ADDRESS,
        );
      });
    });
    describe("WHEN alice sends 105(exactly amount) Asset to mint 100 TC", function () {
      let tx: ContractTransaction;
      let alicePrevACBalance: Balance;
      beforeEach(async function () {
        alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
        tx = await mocFunctions.mintTC({ from: alice, qTC: 100, qACmax: 105 });
      });
      it("THEN alice receives 100 TC", async function () {
        assertPrec(100, await mocFunctions.tcBalanceOf(alice));
      });
      it("THEN Moc balance increase 100 AC", async function () {
        assertPrec(100, await mocFunctions.acBalanceOf(mocContracts.mocImpl.address));
      });
      it("THEN Moc Fee Flow balance increase 5% of 100 AC", async function () {
        assertPrec(100 * 0.05, await mocFunctions.acBalanceOf(mocFeeFlow));
      });
      it("THEN alice balance decrease 100 Asset + 5% for Moc Fee Flow", async function () {
        const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
        const diff = alicePrevACBalance.sub(aliceActualACBalance);
        assertPrec(100 * 1.05, diff);
      });
      it("THEN a TCMinted event is emitted", async function () {
        // sender: alice || mocWrapper
        // receiver: alice
        // qTC: 100 TC
        // qAC: 100 AC + 5% for Moc Fee Flow
        // qACfee: %5 AC
        await expect(tx)
          .to.emit(mocContracts.mocImpl, "TCMinted")
          .withArgs(mocContracts.mocWrapper?.address || alice, alice, pEth(100), pEth(100 * 1.05), pEth(100 * 0.05));
      });
      it("THEN a Collateral Token Transfer event is emitted", async function () {
        // from: Zero Address
        // to: alice
        // amount: 100 TC
        await expect(tx)
          .to.emit(mocContracts.mocCollateralToken, "Transfer")
          .withArgs(CONSTANTS.ZERO_ADDRESS, alice, pEth(100));
      });
      describe("AND alice sends 1000(exceeded amount) Asset to mint 100 TC", function () {
        let alicePrevACBalance: Balance;
        let alicePrevTCBalance: Balance;
        let mocPrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          alicePrevTCBalance = await mocFunctions.tcBalanceOf(alice);
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          await mocFunctions.mintTC({ from: alice, qTC: 100 });
        });
        it("THEN alice receives 100 TC", async function () {
          const aliceActualTCBalance = await mocFunctions.tcBalanceOf(alice);
          const diff = aliceActualTCBalance.sub(alicePrevTCBalance);
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
    describe("WHEN alice sends 105 Asset to mint 100 TC to bob", function () {
      let tx: ContractTransaction;
      let alicePrevACBalance: Balance;
      beforeEach(async function () {
        alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
        tx = await mocFunctions.mintTCto({ from: alice, to: bob, qTC: 100 });
      });
      it("THEN bob receives 100 TC", async function () {
        assertPrec(100, await mocFunctions.tcBalanceOf(bob));
      });
      it("THEN Moc balance increase 100 AC", async function () {
        assertPrec(100, await mocFunctions.acBalanceOf(mocContracts.mocImpl.address));
      });
      it("THEN Moc Fee Flow balance increase 5% of 100 AC", async function () {
        assertPrec(100 * 0.05, await mocFunctions.acBalanceOf(mocFeeFlow));
      });
      it("THEN alice balance decrease 100 Asset + 5% for Moc Fee Flow", async function () {
        const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
        const diff = alicePrevACBalance.sub(aliceActualACBalance);
        assertPrec(100 * 1.05, diff);
      });
      it("THEN a TCMinted event is emitted", async function () {
        // sender: alice || mocWrapper
        // receiver: bob
        // qTC: 100 TC
        // qAC: 100 AC + 5% for Moc Fee Flow
        // qACfee: %5 AC
        await expect(tx)
          .to.emit(mocContracts.mocImpl, "TCMinted")
          .withArgs(mocContracts.mocWrapper?.address || alice, bob, pEth(100), pEth(100 * 1.05), pEth(100 * 0.05));
      });
    });
    describe("GIVEN 3000 TC and 100 TP are minted", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: deployer, qTC: 3000 });
        await mocFunctions.mintTP({ i: TP_0, from: deployer, qTP: 100 });
      });
      describe("AND Collateral Asset relation with Pegged Token price falls to 1 making TC price falls too", function () {
        /*  
        nAC = 3000.4    
        nTP = 100
        lckAC = 100
        => pTCac = 0.9668
        */
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 1);
        });
        describe("WHEN alice tries to mint 1 wei TC", function () {
          it("THEN tx reverts because the amount of TC is too low and out of precision", async function () {
            await expect(
              mocFunctions.mintTC({ from: alice, qTC: 1, applyPrecision: false }),
            ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO);
          });
        });
        describe("WHEN alice mints 100 TC", function () {
          let alicePrevACBalance: Balance;
          beforeEach(async function () {
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            await mocFunctions.mintTC({ from: alice, qTC: 100 });
          });
          it("THEN alice spends 101.51 assets instead of 105", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = alicePrevACBalance.sub(aliceActualACBalance);
            assertPrec("101.51489361702127656", diff);
          });
        });
      });
      describe("AND Collateral Asset relation with Pegged Token price falls to 1/15.5", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, "0.064516129032258064");
        });
        describe("WHEN Alice tries to mint 100 TC", function () {
          /*  
            nAC = 3100    
            nTP = 100
            lckAC = 1550
            => coverage = 2 
        */
          it("THEN tx reverts because coverage is below the protected threshold", async function () {
            await expect(mocFunctions.mintTC({ from: alice, qTC: 100 })).to.be.revertedWithCustomError(
              mocContracts.mocImpl,
              ERRORS.LOW_COVERAGE,
            );
          });
        });
      });
      describe("AND Pegged Token has been devaluated to 500 making TC price rices", function () {
        /*  
        nAC = 3000.4    
        nTP = 100
        lckAC = 0.2
        => pTCac = 1.00006
        */
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 500);
        });
        describe("WHEN alice mints 100 TC", function () {
          let alicePrevACBalance: Balance;
          beforeEach(async function () {
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            await mocFunctions.mintTC({ from: alice, qTC: 100 });
          });
          it("THEN alice spends 105.007 assets instead of 105", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = alicePrevACBalance.sub(aliceActualACBalance);
            assertPrec("105.007893617021276595", diff);
          });
        });
        describe("AND the settlement is executed", function () {
          beforeEach(async function () {
            const nextBlockSettlement = await mocContracts.mocSettlement.bns();
            await mineUpTo(nextBlockSettlement);
            await mocContracts.mocSettlement.execSettlement();
          });
          describe("AND Pegged Token has been devaluated to 1000", function () {
            /*  
            nAC = 3000.4    
            nTP = 100
            lckACLstset = 0.2
            lckAC = 0.1
            ACtoMint = 0.06
            => pTCac = 1.00008
            */
            beforeEach(async function () {
              await mocFunctions.pokePrice(TP_0, 1000);
            });
            describe("WHEN alice mints 100 TC", function () {
              let alicePrevACBalance: Balance;
              beforeEach(async function () {
                alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
                await mocFunctions.mintTC({ from: alice, qTC: 100 });
              });
              it("THEN alice spends 105.009 assets instead of 105", async function () {
                const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
                const diff = alicePrevACBalance.sub(aliceActualACBalance);
                assertPrec("105.009293617021276560", diff);
              });
            });
          });
        });
      });
    });
  });
};

export { mintTCBehavior };
