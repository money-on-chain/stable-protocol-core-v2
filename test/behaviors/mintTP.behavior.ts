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
      describe("WHEN alice sends 0.4 Asset to mint 100 TP", function () {
        // TP price: 235 => 100TP = 0.4255 Assets
        it("THEN tx reverts because the amount of AC is insufficient", async function () {
          await expect(mocFunctions.mintTP({ i: 0, from: alice, qTP: 100, qACmax: 0.4 })).to.be.revertedWithCustomError(
            mocContracts.mocImpl,
            ERRORS.INSUFFICIENT_QAC_SENT,
          );
        });
      });
      describe("WHEN alice sends 105(exactly amount) Asset to mint 23500 TP", function () {
        let tx: ContractTransaction;
        let alicePrevACBalance: Balance;
        let mocPrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          tx = await mocFunctions.mintTP({ i: 0, from: alice, qTP: 23500, qACmax: 105 });
        });
        it("THEN alice receives 23500 TP", async function () {
          assertPrec(23500, await mocFunctions.tpBalanceOf(0, alice));
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
        it("THEN a TPMinted event is emitted", async function () {
          // sender: alice || mocWrapper
          // receiver: alice
          // qTP: 23500 TP
          // qAC: 100 AC + 5% for Moc Fee Flow
          // qACfee: 5% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPMinted")
            .withArgs(
              0,
              mocContracts.mocWrapper?.address || alice,
              alice,
              pEth(23500),
              pEth(100 * 1.05),
              pEth(100 * 0.05),
            );
        });
        it("THEN a Pegged Token Transfer event is emitted", async function () {
          // from: Zero Address
          // to: alice
          // amount: 23500 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[0], "Transfer")
            .withArgs(CONSTANTS.ZERO_ADDRESS, alice, pEth(23500));
        });
        describe("AND alice tries to mint 131739 TP more", function () {
          /*  
            nAC = 3100    
            nTP = 23500
            lckAC = 100
            ctarg = 5.54
            => TP available to mint = 131738.2238
        */
          it("THEN tx reverts because there is not enough TP to mint", async function () {
            await expect(mocFunctions.mintTP({ i: 0, from: alice, qTP: 131738.23 })).to.be.revertedWithCustomError(
              mocContracts.mocImpl,
              ERRORS.INSUFFICIENT_TP_TO_MINT,
            );
          });
        });
        describe("AND alice sends 2350000(exceeded amount) Asset to mint 23500 TP", function () {
          /*  
            nAC = 3100    
            nTP = 23500
            lckAC = 100
            ctarg = 5.54
            => TP available to mint = 131738.2238
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
            await mocFunctions.mintTP({ i: 0, from: alice, qTP: 23500 });
          });
          it("THEN alice receives 23500 TP", async function () {
            const aliceActualTPBalance = await mocFunctions.tpBalanceOf(0, alice);
            const diff = aliceActualTPBalance.sub(alicePrevTPBalance);
            assertPrec(23500, diff);
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
      describe("WHEN alice sends 105 Asset to mint 23500 TP to bob", function () {
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
          tx = await mocFunctions.mintTPto({ i: 0, from: alice, to: bob, qTP: 23500 });
        });
        it("THEN bob receives 23500 TP", async function () {
          assertPrec(23500, await mocFunctions.tpBalanceOf(0, bob));
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
        it("THEN a TPMinted event is emitted", async function () {
          // sender: alice || mocWrapper
          // receiver: bob
          // qTP: 23500 TP
          // qAC: 100 AC + 5% for Moc Fee Flow
          // qACfee: 5% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPMinted")
            .withArgs(
              0,
              mocContracts.mocWrapper?.address || alice,
              bob,
              pEth(23500),
              pEth(100 * 1.05),
              pEth(100 * 0.05),
            );
        });
      });
      describe("AND 23500 TP are minted", function () {
        beforeEach(async function () {
          await mocFunctions.mintTP({ i: 0, from: deployer, qTP: 23500 });
        });
        describe("AND Collateral Asset relation with Pegged Token price falls to 37.9", function () {
          /*  
            nAC = 3100    
            nTP = 23500
            lckAC = 620
            => coverage = 5 
        */
          beforeEach(async function () {
            await mocFunctions.pokePrice(0, "37.9");
          });
          describe("WHEN Alice tries to mint 1 TP", function () {
            it("THEN tx reverts because coverage is below the target coverage adjusted by the moving average", async function () {
              await expect(mocFunctions.mintTP({ i: 0, from: alice, qTP: 1 })).to.be.revertedWithCustomError(
                mocContracts.mocImpl,
                ERRORS.LOW_COVERAGE,
              );
            });
          });
        });
        describe("AND Collateral Asset relation with Pegged Token price falls to 38, so there are 75 TP available to mint", function () {
          /*  
            nAC = 3100    
            nTP = 23500
            lckAC = 618
            ctarg = 5
            => TP available to mint = 75
        */
          beforeEach(async function () {
            await mocFunctions.pokePrice(0, 38);
          });
          describe("WHEN Alice tries to mint 75.1 TP", function () {
            it("THEN tx reverts because there is not enough TP to mint", async function () {
              await expect(mocFunctions.mintTP({ i: 0, from: alice, qTP: 75.1 })).to.be.revertedWithCustomError(
                mocContracts.mocImpl,
                ERRORS.INSUFFICIENT_TP_TO_MINT,
              );
            });
          });
          describe("WHEN Alice mints 75 TP", function () {
            let alicePrevTPBalance: Balance;
            beforeEach(async function () {
              alicePrevTPBalance = await mocFunctions.tpBalanceOf(0, alice);
              await mocFunctions.mintTP({ i: 0, from: alice, qTP: 75 });
            });
            it("THEN alice receives 75 TP", async function () {
              const aliceActualTPBalance = await mocFunctions.tpBalanceOf(0, alice);
              const diff = aliceActualTPBalance.sub(alicePrevTPBalance);
              assertPrec(75, diff);
            });
          });
        });
        describe("AND Collateral Asset relation with Pegged Token price raises to 300, so there are 125739.3087 TP available to mint", function () {
          /*  
            nAC = 3100    
            nTP = 23500
            lckAC = 78.33
            ctarg = 7.07
            => TP available to mint = 125739.3087
        */
          beforeEach(async function () {
            await mocFunctions.pokePrice(0, 300);
          });
          describe("WHEN Alice tries to mint 125739.31 TP", function () {
            it("THEN tx reverts because there is not enough TP to mint", async function () {
              await expect(mocFunctions.mintTP({ i: 0, from: alice, qTP: 125739.31 })).to.be.revertedWithCustomError(
                mocContracts.mocImpl,
                ERRORS.INSUFFICIENT_TP_TO_MINT,
              );
            });
          });
          describe("WHEN Alice mints 125739.3 TP", function () {
            let alicePrevTPBalance: Balance;
            beforeEach(async function () {
              alicePrevTPBalance = await mocFunctions.tpBalanceOf(0, alice);
              await mocFunctions.mintTP({ i: 0, from: alice, qTP: 125739.3 });
            });
            it("THEN alice receives 125739.3 TP", async function () {
              const aliceActualTPBalance = await mocFunctions.tpBalanceOf(0, alice);
              const diff = aliceActualTPBalance.sub(alicePrevTPBalance);
              assertPrec(125739.3, diff);
            });
          });
        });
      });
    });
  });
};

export { mintTPBehavior };
