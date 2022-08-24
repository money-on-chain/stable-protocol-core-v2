import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { Balance, CUSTOM_ERRORS, pEth } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";
import { expect } from "chai";

const mintTCBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;
  const mocFeeFlow = mocAddresses["hardhat"].mocFeeFlowAddress;

  describe("Feature: mint Collateral Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ alice, bob } = await getNamedAccounts());
    });
    describe("WHEN alice sends 0 AC to mint TC", function () {
      it("THEN tx reverts because the amount of AC is invalid", async function () {
        await expect(mocFunctions.mintTC(alice, 0)).to.be.revertedWithCustomError(
          mocContracts.mocCore,
          CUSTOM_ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN alice sends 10 AC to mint 100 TC", function () {
      it("THEN tx reverts because the amount of AC is insufficient", async function () {
        await expect(mocFunctions.mintTC(alice, 100, 10)).to.be.revertedWithCustomError(
          mocContracts.mocCore,
          CUSTOM_ERRORS.INSUFFICIENT_QAC_SENT,
        );
      });
    });
    describe("WHEN alice sends 100 AC to mint 100 TC", function () {
      let tx: ContractTransaction;
      let alicePrevACBalance: Balance;
      beforeEach(async function () {
        alicePrevACBalance = await mocFunctions.acBalanceOf(alice);
        tx = await mocFunctions.mintTC(alice, 100);
      });
      it("THEN alice receives 100 TC", async function () {
        assertPrec(100, await mocFunctions.tcBalanceOf(alice));
      });
      it("THEN Moc balance increase 100 AC", async function () {
        assertPrec(100, await mocFunctions.acBalanceOf(mocContracts.mocCore.address));
      });
      it("THEN Moc Fee Flow balance increase 5% of 100 AC", async function () {
        assertPrec(100 * 0.05, await mocFunctions.acBalanceOf(mocFeeFlow));
      });
      it("THEN alice balance decrease 100 AC + 5% for Moc Fee Flow", async function () {
        const aliceActualACBalance = await mocFunctions.acBalanceOf(alice);
        const diff = alicePrevACBalance.sub(aliceActualACBalance);
        assertPrec(100 * 1.05, diff);
      });
      it("THEN a TCMinted event is emmited", async function () {
        // sender: alice
        // receiver: alice
        // qTC: 100 TC
        // qAC: 100 AC + 5% for Moc Fee Flow
        await expect(tx)
          .to.emit(mocContracts.mocCore, "TCMinted")
          .withArgs(alice, alice, pEth(100), pEth(100 * 1.05));
      });
      describe("AND alice sends again 100 AC to mint 100 TC", function () {
        let alicePrevACBalance: Balance;
        let alicePrevTCBalance: Balance;
        let mocPrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.acBalanceOf(alice);
          alicePrevTCBalance = await mocFunctions.tcBalanceOf(alice);
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocCore.address);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          await mocFunctions.mintTC(alice, 100);
        });
        it("THEN alice receives 100 TC", async function () {
          const aliceActualTCBalance = await mocFunctions.tcBalanceOf(alice);
          const diff = aliceActualTCBalance.sub(alicePrevTCBalance);
          assertPrec(100, diff);
        });
        it("THEN Moc balance increase 100 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocCore.address);
          const diff = mocActualACBalance.sub(mocPrevACBalance);
          assertPrec(100, diff);
        });
        it("THEN Moc Fee Flow balance increase 5% of 100 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(100 * 0.05, diff);
        });
        it("THEN alice balance decrease 100 AC + 5% for Moc Fee Flow", async function () {
          const aliceActualACBalance = await mocFunctions.acBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec(100 * 1.05, diff);
        });
      });
    });
    describe("WHEN alice sends 100 AC to mint 100 TC to bob", function () {
      let tx: ContractTransaction;
      let alicePrevACBalance: Balance;
      beforeEach(async function () {
        alicePrevACBalance = await mocFunctions.acBalanceOf(alice);
        tx = await mocFunctions.mintTCto(alice, bob, 100);
      });
      it("THEN bob receives 100 TC", async function () {
        assertPrec(100, await mocFunctions.tcBalanceOf(bob));
      });
      it("THEN Moc balance increase 100 AC", async function () {
        assertPrec(100, await mocFunctions.acBalanceOf(mocContracts.mocCore.address));
      });
      it("THEN Moc Fee Flow balance increase 5% of 100 AC", async function () {
        assertPrec(100 * 0.05, await mocFunctions.acBalanceOf(mocFeeFlow));
      });
      it("THEN alice balance decrease 100 AC + 5% for Moc Fee Flow", async function () {
        const aliceActualACBalance = await mocFunctions.acBalanceOf(alice);
        const diff = alicePrevACBalance.sub(aliceActualACBalance);
        assertPrec(100 * 1.05, diff);
      });
      it("THEN a TCMinted event is emmited", async function () {
        // sender: alice
        // receiver: bob
        // qTC: 100 TC
        // qAC: 100 AC + 5% for Moc Fee Flow
        await expect(tx)
          .to.emit(mocContracts.mocCore, "TCMinted")
          .withArgs(alice, bob, pEth(100), pEth(100 * 1.05));
      });
    });
  });
};

export { mintTCBehavior };
