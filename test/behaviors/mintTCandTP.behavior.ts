import hre, { getNamedAccounts } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { beforeEach } from "mocha";
import { assertPrec } from "../helpers/assertHelper";
import { Balance, ERRORS, pEth, CONSTANTS } from "../helpers/utils";
import { getNetworkConfig } from "../../scripts/utils";

const mintTCandTPBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;

  const { mocFeeFlowAddress } = getNetworkConfig(hre).deployParameters.mocAddresses;

  describe("Feature: joint Mint TC and TP operation", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ alice, bob } = await getNamedAccounts());
    });
    describe("GIVEN the protocol is empty", function () {
      describe("WHEN alice asks for 2350 TP using mintTCandTP", function () {
        /*
          nAC = 0
          lckAC = 0
          coverage = 41.266
          pTCac = 1
          ctargemaCA = 4
          qTC = 30 TC
          qAC = 30 AC + 10 AC + 8% for Moc Fee Flow
          coverage = (0 + 40) / 10  
        */
        let tx: ContractTransaction;
        beforeEach(async function () {
          tx = await mocFunctions.mintTCandTP({ i: TP_0, from: alice, qTP: 2350 });
        });
        it("THEN coverage goes to 4, ctargemaCA value", async function () {
          assertPrec(4, await mocContracts.mocImpl.getCglb());
        });
        it("THEN a TCandTPMinted event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: alice
          // qTC: 30 TC
          // qTP: 2350 TP
          // qAC: 30 AC + 10 AC + 8% for Moc Fee Flow
          // qACfee: 8% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TCandTPMinted")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              alice,
              pEth(30),
              pEth(2350),
              pEth(43.2),
              pEth(3.2),
            );
        });
      });
    });
    describe("GIVEN alice has 3000 TC, 23500 TP 0", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 3000 });
        await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500 });
      });
      describe("WHEN alice sends 59.84(less amount) AC to mint 2350 TP", function () {
        it("THEN tx reverts because the amount of AC is insufficient", async function () {
          await expect(
            mocFunctions.mintTCandTP({ i: TP_0, from: alice, qTP: 2350, qACmax: "59.847198641765704575" }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.INSUFFICIENT_QAC_SENT);
        });
      });
      describe("WHEN alice tries to mint 1 wei TP", function () {
        it("THEN tx reverts because the amount of TP is too low and out of precision", async function () {
          await expect(
            mocFunctions.mintTCandTP({ i: TP_0, from: alice, qTP: 1, applyPrecision: false }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO);
        });
      });
      describe("WHEN alice sends 59.84(exactly amount) AC to mint 2350 TP", function () {
        /*
        nAC = 3100    
        nTP = 23500
        lckAC = 100 
        ctargemaCA = 5.54
        qTC = 45.4 TC
        qAC = 45.4 AC + 10 AC + 8% for Moc Fee Flow
        coverage = (3100 + 54.4) / 110  
        */
        let tx: ContractTransaction;
        let tcPriceBefore: BigNumber;
        let alicePrevTCBalance: Balance;
        let alicePrevTPBalance: Balance;
        let alicePrevACBalance: Balance;
        let mocPrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        beforeEach(async function () {
          [
            tcPriceBefore,
            alicePrevTCBalance,
            alicePrevTPBalance,
            alicePrevACBalance,
            mocPrevACBalance,
            mocFeeFlowPrevACBalance,
          ] = await Promise.all([
            mocContracts.mocImpl.getPTCac(),
            mocFunctions.tcBalanceOf(alice),
            mocFunctions.tpBalanceOf(TP_0, alice),
            mocFunctions.assetBalanceOf(alice),
            mocFunctions.acBalanceOf(mocContracts.mocImpl.address),
            mocFunctions.acBalanceOf(mocFeeFlowAddress),
          ]);
          tx = await mocFunctions.mintTCandTP({ i: TP_0, from: alice, qTP: 2350, qACmax: "59.847198641765704576" });
        });
        it("THEN coverage decrease to 28.68", async function () {
          assertPrec("28.685582480149542967", await mocContracts.mocImpl.getCglb());
        });
        it("THEN TC price did not change", async function () {
          assertPrec(tcPriceBefore, await mocContracts.mocImpl.getPTCac());
        });
        it("THEN alice TC balance increase 45.41 TC", async function () {
          const aliceActualTCBalance = await mocFunctions.tcBalanceOf(alice);
          const diff = aliceActualTCBalance.sub(alicePrevTCBalance);
          assertPrec("45.414072816449726460", diff);
        });
        it("THEN alice TP balance increase 2350 TP", async function () {
          const aliceActualTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          const diff = aliceActualTPBalance.sub(alicePrevTPBalance);
          assertPrec(2350, diff);
        });
        it("THEN alice AC balance decrease 59.84 AC", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec("59.847198641765704576", diff);
        });
        it("THEN Moc balance increase 55.41 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          const diff = mocActualACBalance.sub(mocPrevACBalance);
          assertPrec("55.414072816449726460", diff);
        });
        it("THEN Moc Fee Flow balance increase 8% of 45.4 AC + 8% of 10 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec("4.433125825315978116", diff);
        });
        it("THEN a TCandTPMinted event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: alice
          // qTC: 45.41 TC
          // qTP: 2350 TP
          // qAC: 45.4 AC + 10 AC + 8% for Moc Fee Flow
          // qACfee: 8% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TCandTPMinted")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              alice,
              pEth("45.414072816449726460"),
              pEth(2350),
              pEth("59.847198641765704576"),
              pEth("4.433125825315978116"),
            );
        });
        it("THEN a Collateral Token Transfer event is emitted", async function () {
          // from: Zero Address
          // to: alice
          // amount: 100 TC
          await expect(tx)
            .to.emit(mocContracts.mocCollateralToken, "Transfer")
            .withArgs(CONSTANTS.ZERO_ADDRESS, alice, pEth("45.414072816449726460"));
        });
        it("THEN a Pegged Token Transfer event is emitted", async function () {
          // from: Zero Address
          // to: alice
          // amount: 783.33 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[TP_0], "Transfer")
            .withArgs(CONSTANTS.ZERO_ADDRESS, alice, pEth(2350));
        });
      });
      describe("WHEN alice sends 589.8(exceeded amount) AC to mint 2350 TP to bob", function () {
        /*
        nAC = 3100    
        nTP = 23500
        lckAC = 100 
        ctargemaCA = 5.54
        qTC = 45.4 TC
        qAC = 45.4 AC + 10 AC + 8% for Moc Fee Flow
        coverage = (3100 + 54.4) / 110  
        */
        let tx: ContractTransaction;
        beforeEach(async function () {
          tx = await mocFunctions.mintTCandTPto({ i: TP_0, from: alice, to: bob, qTP: 2350 });
        });
        it("THEN bob TC balance increase 45.41 TC", async function () {
          assertPrec("45.414072816449726460", await mocFunctions.tcBalanceOf(bob));
        });
        it("THEN bob TP balance increase 2350 TP", async function () {
          assertPrec(2350, await mocFunctions.tpBalanceOf(TP_0, bob));
        });
        it("THEN a TCandTPMinted event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: bob
          // qTC: 45.41 TC
          // qTP: 2350 TP
          // qAC: 45.4 AC + 10 AC + 8% for Moc Fee Flow
          // qACfee: 8% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TCandTPMinted")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              bob,
              pEth("45.414072816449726460"),
              pEth(2350),
              pEth("59.847198641765704576"),
              pEth("4.433125825315978116"),
            );
        });
      });
      describe("AND TP 0 revalues to 10 making TC price to drop and protocol to be in low coverage", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 10);
        });
        describe("WHEN alice mints 23500 TP", function () {
          /*
            nAC = 3100
            lckAC = 2350
            coverage = 1.319
            pTCac = 0.25
            ctargemaCA = 5
            qTC = 37600 TC
            qAC = 9400 AC + 2350 AC + 8% for Moc Fee Flow
            coverage = (3100 + 11750) / 4700  
          */
          let tx: ContractTransaction;
          beforeEach(async function () {
            tx = await mocFunctions.mintTCandTP({ i: TP_0, from: alice, qTP: 23500 });
          });
          it("THEN coverage increase to 3.15", async function () {
            assertPrec("3.159574468085106382", await mocContracts.mocImpl.getCglb());
          });
          it("THEN a TCandTPMinted event is emitted", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: alice
            // qTC: 37600 TC
            // qTP: 23500 TP
            // qAC: 9400 AC + 2350 AC + 8% for Moc Fee Flow
            // qACfee: 8% AC
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TCandTPMinted")
              .withArgs(
                TP_0,
                mocContracts.mocWrapper?.address || alice,
                alice,
                pEth(37600),
                pEth(23500),
                pEth(12690),
                pEth(940),
              );
          });
        });
      });
      describe("AND TP 0 devaluates to 470 making TC price to rise", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 470);
        });
        describe("WHEN alice mints 23500 TP", function () {
          /*
            nAC = 3100
            lckAC = 50 + 25(tpGain)
            nACgain = 5
            coverage = 41.266
            pTCac = 1.0066
            ctargemaCA = 11.08
            qTC = 500.8 TC
            qAC = 504.14 AC + 50 AC + 8% for Moc Fee Flow
            coverage = (3100 + 554.14) / 125  
          */
          let tx: ContractTransaction;
          beforeEach(async function () {
            tx = await mocFunctions.mintTCandTP({ i: TP_0, from: alice, qTP: 23500 });
          });
          it("THEN coverage decrease to 29.19", async function () {
            assertPrec("29.193125825315978117", await mocContracts.mocImpl.getCglb());
          });
          it("THEN a TCandTPMinted event is emitted", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: alice
            // qTC: 500.08 TC
            // qTP: 23500 TP
            // qAC: 9400 AC + 2350 AC + 8% for Moc Fee Flow
            // qACfee: 8% AC
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TCandTPMinted")
              .withArgs(
                TP_0,
                mocContracts.mocWrapper?.address || alice,
                alice,
                pEth("500.802047845527084421"),
                pEth(23500),
                pEth("598.471986417657045822"),
                pEth("44.331258253159781172"),
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
          await expect(mocFunctions.mintTCandTP({ i: TP_0, from: alice, qTP: 23500 })).to.be.revertedWithCustomError(
            mocContracts.mocImpl,
            ERRORS.LOW_COVERAGE,
          );
        });
      });
    });
  });
};

export { mintTCandTPBehavior };
