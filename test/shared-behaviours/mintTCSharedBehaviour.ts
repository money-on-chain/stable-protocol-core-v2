import { getNamedAccounts } from "hardhat";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { BigNumber } from "@ethersproject/bignumber";

const mintTCSharedBehaviour = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let mocFeeFlow: Address;
  let alice: Address;

  describe("Feature: mint Collateral Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ mocFeeFlow, alice } = await getNamedAccounts());
    });
    describe("WHEN alice sends 100 rbtc to mint Collateral Token", function () {
      [0, 100].forEach(qTC => {
        describe(`AND there are ${qTC} Collateral Token`, function () {
          let mocFeeFlowPrevBalance: BigNumber;
          beforeEach(async function () {
            mocFeeFlowPrevBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
            if (qTC) {
              await mocFunctions.mintTC(alice, qTC);
            }
            await mocFunctions.mintTC(alice, 100);
          });
          it("THEN alice receives 100 Collateral Token", async function () {
            assertPrec(100 + qTC, await mocFunctions.tcBalanceOf(alice));
          });
          it("THEN Moc balance increase 100 rbtc", async function () {
            assertPrec(100 + qTC, await mocFunctions.acBalanceOf(mocContracts.mocCore.address));
          });
          it("THEN Moc Fee Flow receives 5% of 100 rbtc", async function () {
            const mocFeeFlowActualBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
            const diff = mocFeeFlowActualBalance.sub(mocFeeFlowPrevBalance);
            assertPrec((100 + qTC) * 0.05, diff);
          });
        });
      });
    });
  });
};

export { mintTCSharedBehaviour };
