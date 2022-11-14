import { getNamedAccounts } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { assertPrec } from "../helpers/assertHelper";
import { Balance, CONSTANTS, ERRORS, mineUpTo, pEth } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";

const swapTPforTCBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;
  const TP_1 = 1;

  const { mocFeeFlowAddress, mocInterestCollectorAddress } = mocAddresses["hardhat"];
  const fixedBlock = 85342;

  let coverageBefore: BigNumber;
  let tx: ContractTransaction;
  let alicePrevTP0Balance: Balance;
  let alicePrevACBalance: Balance;
  let mocPrevACBalance: Balance;
  let mocFeeFlowPrevACBalance: Balance;
  let mocInterestCollectorPrevACBalance: Balance;

  describe("Feature: swap Pegged Token for another Pegged Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ deployer, alice, bob } = await getNamedAccounts());
      // add collateral
      await mocFunctions.mintTC({ from: deployer, qTC: 3000 });
    });
    describe("GIVEN alice has 23500 TP 0", function () {
      beforeEach(async function () {
        await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500 });
      });
      describe("WHEN alice tries to swap 0 TP 0", function () {
        it("THEN tx reverts because the amount of AC is invalid", async function () {
          await expect(mocFunctions.swapTPforTC({ i: TP_0, from: alice, qTP: 0 })).to.be.revertedWithCustomError(
            mocContracts.mocImpl,
            ERRORS.INVALID_VALUE,
          );
        });
      });
      describe("WHEN alice tries to swap 1 wei TP 0", function () {
        it("THEN tx reverts because the amount of TP is too low and out of precision", async function () {
          await expect(
            mocFunctions.swapTPforTC({ i: TP_0, from: alice, qTP: 1, applyPrecision: false }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.QTC_BELOW_MINIMUM);
        });
      });
      describe("WHEN alice swap 23500 TP 0 sending 1.09(less amount) Asset for fees", function () {
        it("THEN tx reverts because Asset received is below the minimum required", async function () {
          await expect(
            mocFunctions.swapTPforTC({ i: TP_0, from: alice, qTP: 23500, qACmax: "1.099931712962962899" }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.INSUFFICIENT_QAC_SENT);
        });
      });
      describe("WHEN alice swap 23500 TP 0 expecting receive 101 TC as minimum", function () {
        /*
            23500 TP 0 = 100 AC
            100 AC = 100 TC
          */
        it("THEN tx reverts because TC received is below the minimum required", async function () {
          await expect(
            mocFunctions.swapTPforTC({ i: TP_0, from: alice, qTP: 23500, qTCmin: 101 }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.QTC_BELOW_MINIMUM);
        });
      });
      describe("WHEN alice swap 23500(all balance) TP 0 for 100 TC", function () {
        /*
            23500 TP 0 = 100 AC
            100 AC = 100 TC

            swapTPforTCfee = 1%

            arb = 1 => fctb = 0.1
            arf = 1 => fctb = 0.1
            => fctAvg = 0.1
            tils = 1%
            => interest = 1% * 0.1 * (85339/86400) = 0.0987%
          */
        beforeEach(async function () {
          [
            coverageBefore,
            alicePrevACBalance,
            mocPrevACBalance,
            mocFeeFlowPrevACBalance,
            mocInterestCollectorPrevACBalance,
          ] = await Promise.all([
            mocContracts.mocImpl.getCglb(),
            mocFunctions.assetBalanceOf(alice),
            mocFunctions.acBalanceOf(mocContracts.mocImpl.address),
            mocFunctions.acBalanceOf(mocFeeFlowAddress),
            mocFunctions.acBalanceOf(mocInterestCollectorAddress),
          ]);
          // go forward to a fixed block remaining for settlement to avoid unpredictability
          const bns = await mocContracts.mocSettlement.bns();
          await mineUpTo(bns.sub(fixedBlock));
          tx = await mocFunctions.swapTPforTC({ i: TP_0, from: alice, qTP: 23500, qTPmin: 100 });
        });
        it("THEN coverage didn´t change", async function () {
          assertPrec(coverageBefore, await mocContracts.mocImpl.getCglb());
        });
        it("THEN alice TP 0 balance is 0", async function () {
          assertPrec(0, await mocFunctions.tpBalanceOf(TP_0, alice));
        });
        it("THEN alice TC balance is 100", async function () {
          assertPrec(100, await mocFunctions.tcBalanceOf(alice));
        });
        it("THEN Moc balance didn´t change", async function () {
          assertPrec(mocPrevACBalance, await mocFunctions.acBalanceOf(mocContracts.mocImpl.address));
        });
        it("THEN Moc Fee Flow balance increase 1% of 100 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(100 * 0.01, diff);
        });
        it("THEN Moc Interest Collector balance increase 0.0987% of 100 AC", async function () {
          const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
          assertPrec("0.098771990740740700", diff);
        });
        it("THEN alice balance decrease 1% for Moc Fee Flow + 0.0987% for Moc Interest Collector of 100 Asset", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec("1.098771990740740700", diff);
        });
        it("THEN a TPSwapped event is emitted", async function () {
          // iFrom: 0
          // iTo: 1
          // sender: alice || mocWrapper
          // receiver: alice
          // qTPfrom: 23500 TP
          // qTPto: 525 TP
          // qACfee: 1% AC
          // qACInterest: 0.0987% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPSwapped")
            .withArgs(
              TP_0,
              TP_1,
              mocContracts.mocWrapper?.address || alice,
              alice,
              pEth(23500),
              pEth(525),
              pEth(100 * 0.01),
              pEth("0.098771990740740700"),
            );
        });
        it("THEN a Pegged Token 0 Transfer event is emitted", async function () {
          // from: alice || mocWrapper
          // to: Zero Address
          // amount: 23500 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[TP_0], "Transfer")
            .withArgs(mocContracts.mocWrapper?.address || alice, CONSTANTS.ZERO_ADDRESS, pEth(23500));
        });
        it("THEN a Pegged Token 1 Transfer event is emitted", async function () {
          // from: Zero Address
          // to: alice
          // amount: 525 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[TP_1], "Transfer")
            .withArgs(CONSTANTS.ZERO_ADDRESS, alice, pEth(525));
        });
      });
      describe("WHEN alice swap 2350(10% of balance) TP 0 for 10 TC to bob", function () {
        /*
            2350 TP 0 = 10 AC
            10 AC = 10 TC

            swapTPforTCfee = 1%

            arb = 1 => fctb = 0.1
            arf = 1 => fctb = 0.1
            => fctAvg = 0.1
            tils = 1%
            => interest = 1% * 0.1 * (85339/86400) = 0.0987%
          */
        beforeEach(async function () {
          coverageBefore = await mocContracts.mocImpl.getCglb();
          alicePrevTP0Balance = await mocFunctions.tpBalanceOf(TP_0, alice);
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          // go forward to a fixed block remaining for settlement to avoid unpredictability
          const bns = await mocContracts.mocSettlement.bns();
          await mineUpTo(bns.sub(fixedBlock));
          tx = await mocFunctions.swapTPforTCto({
            i: TP_0,
            from: alice,
            to: bob,
            qTP: 2350,
            qTCmin: 10,
          });
        });
        it("THEN coverage didn´t change", async function () {
          assertPrec(coverageBefore, await mocContracts.mocImpl.getCglb());
        });
        it("THEN alice TP 0 balances decrease 2350 TP", async function () {
          const aliceActualTP0Balance = await mocFunctions.tpBalanceOf(TP_0, alice);
          const diff = alicePrevTP0Balance.sub(aliceActualTP0Balance);
          assertPrec(2350, diff);
        });
        it("THEN bob TC balances is 10", async function () {
          assertPrec(10, await mocFunctions.tcBalanceOf(bob));
        });
        it("THEN Moc balance didn´t change", async function () {
          assertPrec(mocPrevACBalance, await mocFunctions.acBalanceOf(mocContracts.mocImpl.address));
        });
        it("THEN a TPSwapped event is emitted", async function () {
          // iFrom: 0
          // iTo: 1
          // sender: alice || mocWrapper
          // receiver: bob
          // qTPfrom: 2350 TP
          // qTPto: 52.5 TP
          // qACfee: 1% AC
          // qACInterest: 0.0987% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPSwapped")
            .withArgs(
              TP_0,
              TP_1,
              mocContracts.mocWrapper?.address || alice,
              bob,
              pEth(2350),
              pEth(52.5),
              pEth(10 * 0.01),
              pEth("0.009877199074074070"),
            );
        });
      });
    });
  });
};
export { swapTPforTCBehavior };
