import { getNamedAccounts } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { Balance, ERRORS, pEth, CONSTANTS, mineUpTo } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";
import { expect } from "chai";
import { beforeEach } from "mocha";

const redeemTCandTPBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;
  const TP_NON_EXISTENT = 4;

  const { mocFeeFlowAddress, mocInterestCollectorAddress } = mocAddresses["hardhat"];
  const fixedBlock = 85342;

  describe("Feature: redeem Pegged Token", function () {
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
      describe("AND TP price provider is deprecated", function () {
        beforeEach(async function () {
          await mocContracts.priceProviders[TP_0].deprecatePriceProvider();
        });
        describe("WHEN alice tries to redeem 100 TC and 23500 TP", function () {
          it("THEN tx reverts because invalid price provider", async function () {
            await expect(
              mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500 }),
            ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.INVALID_PRICE_PROVIDER);
          });
        });
      });
      describe("WHEN alice redeems 100 TC and 2350 TP", function () {
        let coverageBefore: BigNumber;
        beforeEach(async function () {
          coverageBefore = await mocContracts.mocImpl.getCglb();
          await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500 });
        });
        it("THEN coverage did not change", async function () {
          assertPrec(coverageBefore, await mocContracts.mocImpl.getCglb());
        });
      });
    });
  });
};

export { redeemTCandTPBehavior };
