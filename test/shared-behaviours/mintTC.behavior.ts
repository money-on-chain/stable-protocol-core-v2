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
      let alicePrevBalance: Balance;
      beforeEach(async function () {
        alicePrevBalance = await mocFunctions.acBalanceOf(alice);
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
        const aliceActualBalance = await mocFunctions.acBalanceOf(alice);
        const diff = alicePrevBalance.sub(aliceActualBalance);
        assertPrec(100 * 1.05, diff);
      });
    });
  });
};

export { mintTCBehavior };
