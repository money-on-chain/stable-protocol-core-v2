import { getNamedAccounts } from "hardhat";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { Balance } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";

const mintTCBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let alice: Address;
  const mocFeeFlow = mocAddresses["hardhat"].mocFeeFlowAddress;

  describe("Feature: mint Collateral Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ alice } = await getNamedAccounts());
    });
    describe("WHEN alice sends 100 rbtc to mint Collateral Token", function () {
      let alicePrevACBalance: Balance;
      beforeEach(async function () {
        alicePrevACBalance = await mocFunctions.acBalanceOf(alice);
        await mocFunctions.mintTC(alice, 100);
      });
      it("THEN alice receives 100 Collateral Token", async function () {
        assertPrec(100, await mocFunctions.tcBalanceOf(alice));
      });
      it("THEN Moc balance increase 100 rbtc", async function () {
        assertPrec(100, await mocFunctions.acBalanceOf(mocContracts.mocCore.address));
      });
      it("THEN Moc Fee Flow balance increase 5% of 100 rbtc", async function () {
        assertPrec(100 * 0.05, await mocFunctions.acBalanceOf(mocFeeFlow));
      });
      it("THEN alice balance decrease 100 rbtc + 5% for Moc Fee Flow", async function () {
        const aliceActualACBalance = await mocFunctions.acBalanceOf(alice);
        const diff = alicePrevACBalance.sub(aliceActualACBalance);
        assertPrec(100 * 1.05, diff);
      });
      describe("AND alice sends again 100 rbtc to mint Collateral Token", function () {
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
        it("THEN alice receives 100 Collateral Token", async function () {
          const aliceActualTCBalance = await mocFunctions.tcBalanceOf(alice);
          const diff = aliceActualTCBalance.sub(alicePrevTCBalance);
          assertPrec(100, diff);
        });
        it("THEN Moc balance increase 100 rbtc", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocCore.address);
          const diff = mocActualACBalance.sub(mocPrevACBalance);
          assertPrec(100, diff);
        });
        it("THEN Moc Fee Flow balance increase 5% of 100 rbtc", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(100 * 0.05, diff);
        });
        it("THEN alice balance decrease 100 rbtc + 5% for Moc Fee Flow", async function () {
          const aliceActualACBalance = await mocFunctions.acBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec(100 * 1.05, diff);
        });
      });
    });
  });
};

export { mintTCBehavior };
