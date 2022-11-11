import { getNamedAccounts } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { beforeEach } from "mocha";
import { assertPrec } from "../helpers/assertHelper";
import { Balance, ERRORS, pEth, CONSTANTS } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";

const mintTCandTPBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;

  const { mocFeeFlowAddress } = mocAddresses["hardhat"];

  describe("Feature: joint Mint TC and TP operation", function () {
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
      describe("WHEN alice sends 10 Asset to mint 2350 TP", function () {
        it("THEN tx reverts because the amount of AC is insufficient", async function () {
          await expect(
            mocFunctions.mintTCandTP({ i: TP_0, from: alice, qTP: 2350, qACmax: 10 }),
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
      describe("WHEN alice sends 59.84(exactly amount) Assets to mint 23500 TP", function () {
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
          tx = await mocFunctions.mintTCandTP({ i: TP_0, from: alice, qTP: 2350, qACmax: "59.847198641765703918" });
        });
        it("THEN coverage decrease to 28.68", async function () {
          assertPrec("28.685582480149542962", await mocContracts.mocImpl.getCglb());
        });
        it("THEN TC price did not change", async function () {
          assertPrec(tcPriceBefore, await mocContracts.mocImpl.getPTCac());
        });
        it("THEN alice TC balance increase 45.41 TC", async function () {
          const aliceActualTCBalance = await mocFunctions.tcBalanceOf(alice);
          const diff = aliceActualTCBalance.sub(alicePrevTCBalance);
          assertPrec("45.414072816449725850", diff);
        });
        it("THEN alice TP balance increase 2350 TP", async function () {
          const aliceActualTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          const diff = aliceActualTPBalance.sub(alicePrevTPBalance);
          assertPrec(2350, diff);
        });
        it("THEN alice AC balance decrease 59.84 AC", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec("59.847198641765703918", diff);
        });
        it("THEN Moc balance increase 55.41 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          const diff = mocActualACBalance.sub(mocPrevACBalance);
          assertPrec("55.414072816449725850", diff);
        });
        it("THEN Moc Fee Flow balance increase 8% of 45.4 AC + 8% of 10 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec("4.433125825315978068", diff);
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
              pEth("45.414072816449725850"),
              pEth(2350),
              pEth("59.847198641765703918"),
              pEth("4.433125825315978068"),
            );
        });
        it("THEN a Collateral Token Transfer event is emitted", async function () {
          // from: Zero Address
          // to: alice
          // amount: 100 TC
          await expect(tx)
            .to.emit(mocContracts.mocCollateralToken, "Transfer")
            .withArgs(CONSTANTS.ZERO_ADDRESS, alice, pEth("45.414072816449725850"));
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
      describe("WHEN alice sends 589.8(exceeded amount) Assets to mint 23500 TP to bob", function () {
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
          assertPrec("45.414072816449725850", await mocFunctions.tcBalanceOf(bob));
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
              pEth("45.414072816449725850"),
              pEth(2350),
              pEth("59.847198641765703918"),
              pEth("4.433125825315978068"),
            );
        });
      });
      describe("WHEN alice sends 59.84 Assets to mint all", function () {
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
          tx = await mocFunctions.mintTCandTP({
            i: TP_0,
            from: alice,
            qTP: 0,
            qACmax: "59.847198641765703918",
          });
        });
        it("THEN coverage decrease to 28.68", async function () {
          assertPrec("28.685582480149542962", await mocContracts.mocImpl.getCglb());
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
              pEth("45.414072816449725850"),
              pEth(2350),
              pEth("59.847198641765703918"),
              pEth("4.433125825315978068"),
            );
        });
      });
    });
  });
};

export { mintTCandTPBehavior };
