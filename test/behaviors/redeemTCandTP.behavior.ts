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
      describe("WHEN alice redeems 100 TC and 23500 TP", function () {
        /*
            nAC = 3100
            lckAC = 100
            coverage = 31
            pTCac = 1
            => to redeem 100 TC we use 783.3 TP
            => AC redemeed = 100 AC - 5% + 3.33AC - 5% - 0.0987% = 98.16
        */
        let tx: ContractTransaction;
        let coverageBefore: BigNumber;
        let tcPriceBefore: BigNumber;
        let tcLeverageBefore: BigNumber;
        let alicePrevTCBalance: Balance;
        let alicePrevTPBalance: Balance;
        let alicePrevACBalance: Balance;
        let mocPrevACBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        let mocInterestCollectorPrevACBalance: Balance;
        beforeEach(async function () {
          [
            coverageBefore,
            tcPriceBefore,
            tcLeverageBefore,
            alicePrevTCBalance,
            alicePrevTPBalance,
            alicePrevACBalance,
          ] = await Promise.all([
            mocContracts.mocImpl.getCglb(),
            mocContracts.mocImpl.getPTCac(),
            mocContracts.mocImpl.getLeverageTC(),
            mocFunctions.tcBalanceOf(alice),
            mocFunctions.tpBalanceOf(TP_0, alice),
            mocFunctions.acBalanceOf(alice),
          ]);
          // go forward to a fixed block remaining for settlement to avoid unpredictability
          const bns = await mocContracts.mocSettlement.bns();
          await mineUpTo(bns.sub(fixedBlock));
          tx = await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500 });
        });
        it("THEN coverage did not change", async function () {
          assertPrec(coverageBefore, await mocContracts.mocImpl.getCglb());
        });
        it("THEN TC price did not change", async function () {
          assertPrec(tcPriceBefore, await mocContracts.mocImpl.getPTCac());
        });
        it("THEN TC leverage did not change", async function () {
          assertPrec(tcLeverageBefore, await mocContracts.mocImpl.getLeverageTC());
        });
        it("THEN alice TC balance decrease 100 TC", async function () {
          const aliceActualTCBalance = await mocFunctions.tcBalanceOf(alice);
          const diff = alicePrevTCBalance.sub(aliceActualTCBalance);
          assertPrec(100, diff);
        });
        it("THEN alice TP balance decrease 783.33 TP", async function () {
          const aliceActualTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          const diff = alicePrevTPBalance.sub(aliceActualTPBalance);
          assertPrec("783.333333333333333333", diff);
        });
        it("THEN alice AC balance increase 98.16 AC", async function () {
          const aliceActualACBalance = await mocFunctions.acBalanceOf(alice);
          const diff = aliceActualACBalance.sub(alicePrevACBalance);
          assertPrec("98.163374266975308644", diff);
        });
      });
    });
  });
};

export { redeemTCandTPBehavior };
