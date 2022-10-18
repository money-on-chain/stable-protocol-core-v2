import { getNamedAccounts } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { Balance, ERRORS, pEth, CONSTANTS, mineUpTo } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";
import { expect } from "chai";

const swapTPforTPBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;
  const TP_1 = 1;
  const TP_4 = 4;
  const TP_NON_EXISTENT = 5;

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
      describe("AND TP 0 price provider is deprecated", function () {
        beforeEach(async function () {
          await mocContracts.priceProviders[TP_0].deprecatePriceProvider();
        });
        describe("WHEN alice tries to swap TP 0 for TP 1", function () {
          it("THEN tx reverts because invalid price provider", async function () {
            await expect(
              mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23500 }),
            ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.INVALID_PRICE_PROVIDER);
          });
        });
      });
      describe("AND TP 1 price provider is deprecated", function () {
        beforeEach(async function () {
          await mocContracts.priceProviders[TP_1].deprecatePriceProvider();
        });
        describe("WHEN alice tries to swap TP 0 for TP 1", function () {
          it("THEN tx reverts because invalid price provider", async function () {
            await expect(
              mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23500 }),
            ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.INVALID_PRICE_PROVIDER);
          });
        });
      });
      describe("WHEN alice tries to swap TP 0 for TP 0", function () {
        it("THEN tx reverts because invalid value", async function () {
          await expect(
            mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_0, from: alice, qTP: 23500 }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.INVALID_VALUE);
        });
      });
      describe("WHEN alice tries to swap using a non-existent TP", function () {
        it("THEN tx reverts with panice code 0x32 array out of bounded", async function () {
          // generic revert because collateralbag implementation fail before accessing the tp array
          await expect(mocFunctions.swapTPforTP({ iFrom: TP_NON_EXISTENT, iTo: TP_0, from: alice, qTP: 23500 })).to.be
            .reverted;
        });
      });
      describe("WHEN alice tries to swap TP 0 for a non-existent TP", function () {
        it("THEN tx reverts with panice code 0x32 array out of bounded", async function () {
          await expect(
            mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_NON_EXISTENT, from: alice, qTP: 23500 }),
          ).to.be.revertedWithPanic("0x32");
        });
      });
      describe("WHEN alice tries to swap 0 TP 0", function () {
        it("THEN tx reverts because the amount of AC is invalid", async function () {
          await expect(
            mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 0 }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.INVALID_VALUE);
        });
      });
      describe("WHEN alice tries to swap 1 TP 0 to the zero address", function () {
        it("THEN tx reverts because recipient is the zero address", async function () {
          await expect(
            mocFunctions.swapTPforTPto({ iFrom: TP_0, iTo: TP_1, from: alice, to: CONSTANTS.ZERO_ADDRESS, qTP: 23500 }),
          ).to.be.revertedWith("ERC20: mint to the zero address");
        });
      });
      describe("WHEN alice tries to swap 1 wei TP 0", function () {
        it("THEN tx reverts because the amount of TP is too low and out of precision", async function () {
          await expect(
            mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 1, applyPrecision: false }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO);
        });
      });
      describe("AND TP 1 revalues to 0.9", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_1, 0.9);
        });
        describe("WHEN alice tries to swap 235 wei TP 0", function () {
          it("THEN tx reverts because the amount of TP is too low to swap for TP 1", async function () {
            await expect(
              mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 235, applyPrecision: false }),
            ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.INVALID_VALUE);
          });
        });
      });
      describe("WHEN alice tries to swap 23501 TP 0", function () {
        it("THEN tx reverts because there is not enough TP available to redeem", async function () {
          // generic revert because collateralbag implementation fails trying to transfer the TP and
          // the others implementation fail burning
          await expect(mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23501 })).to.be.reverted;
        });
      });
      describe("WHEN alice swap 23500 TP 0 sending 1 Asset for fees", function () {
        it("THEN tx reverts because Asset received is below the minimum required", async function () {
          await expect(
            mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23500, qACmax: 1 }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.INSUFFICIENT_QAC_SENT);
        });
      });
      describe("WHEN alice swap 23500 TP 0 expecting receive 526 TP 1 as minimum", function () {
        /*
            23500 TP 0 = 100 AC
            100 AC = 525 TP 1
          */
        it("THEN tx reverts because Asset received is below the minimum required", async function () {
          await expect(
            mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23500, qTPmin: 526 }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.QTP_BELOW_MINIMUM);
        });
      });
      describe("WHEN alice swap 23500(all balance) TP 0 for 525 TP 1", function () {
        /*
            23500 TP 0 = 100 AC
            100 AC = 525 TP 1

            fee = TP 0 redeem fee + TP 1 mint fee = 5% + 0.1%

            arb = 1 => fctb = 0.1
            arf = 1 => fctb = 0.1
            => fctAvg = 0.1
            tils = 1%
            => interest = 1% * 0.1 * (85339/86400) = 0.0987%
          */
        beforeEach(async function () {
          coverageBefore = await mocContracts.mocImpl.getCglb();
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          mocInterestCollectorPrevACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          // go forward to a fixed block remaining for settlement to avoid unpredictability
          const bns = await mocContracts.mocSettlement.bns();
          await mineUpTo(bns.sub(fixedBlock));
          tx = await mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23500, qTPmin: 525 });
        });
        it("THEN coverage didn´t change", async function () {
          assertPrec(coverageBefore, await mocContracts.mocImpl.getCglb());
        });
        it("THEN alice TP 0 balances is 0", async function () {
          assertPrec(0, await mocFunctions.tpBalanceOf(TP_0, alice));
        });
        it("THEN alice TP 1 balances is 525", async function () {
          assertPrec(525, await mocFunctions.tpBalanceOf(TP_1, alice));
        });
        it("THEN Moc balance didn´t change", async function () {
          assertPrec(mocPrevACBalance, await mocFunctions.acBalanceOf(mocContracts.mocImpl.address));
        });
        it("THEN Moc Fee Flow balance increase 5.1% of 100 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(100 * 0.051, diff);
        });
        it("THEN Moc Interest Collector balance increase 0.0987% of 100 AC", async function () {
          const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
          assertPrec("0.098771990740740700", diff);
        });
        it("THEN alice balance decrease 5.1% for Moc Fee Flow + 0.0987% for Moc Interest Collector of 100 Asset", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec("5.198771990740740700", diff);
        });
        it("THEN a TPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: Moc
          // qTP: 23500 TP
          // qAC: 100 AC - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector
          // qACfee: 5% AC
          // qACInterest: 0.0987% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPRedeemed")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocImpl.address,
              pEth(23500),
              pEth("94.901228009259259300"),
              pEth(100 * 0.05),
              pEth("0.098771990740740700"),
            );
        });
        it("THEN a TPMinted event is emitted", async function () {
          // i: 1
          // sender: Moc
          // receiver: alice
          // qTP: 525 TP
          // qAC: 100 AC + 0.1% for Moc Fee Flow
          // qACfee: 0.1% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPMinted")
            .withArgs(TP_1, mocContracts.mocImpl.address, alice, pEth(525), pEth(100 * 1.001), pEth(100 * 0.001));
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
      describe("WHEN alice swap 2350(10% of balance) TP 0 for 52.5 TP 1 to bob", function () {
        /*
            2350 TP 0 = 10 AC
            10 AC = 52.5 TP 1

            fee = TP 0 redeem fee + TP 1 mint fee = 5% + 0.1%

            arb = 1 => fctb = 0.1
            arf = 1 => fctb = 0.1
            => fctAvg = 0.1
            tils = 1%
            => interest = 1% * 0.1 * (85339/86400) = 0.0987%
          */
        beforeEach(async function () {
          coverageBefore = await mocContracts.mocImpl.getCglb();
          alicePrevTP0Balance = await mocFunctions.tpBalanceOf(TP_0, alice);
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          mocInterestCollectorPrevACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          // go forward to a fixed block remaining for settlement to avoid unpredictability
          const bns = await mocContracts.mocSettlement.bns();
          await mineUpTo(bns.sub(fixedBlock));
          tx = await mocFunctions.swapTPforTPto({
            iFrom: TP_0,
            iTo: TP_1,
            from: alice,
            to: bob,
            qTP: 2350,
            qTPmin: 5.25,
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
        it("THEN bob TP 1 balances is 52.5", async function () {
          assertPrec(52.5, await mocFunctions.tpBalanceOf(TP_1, bob));
        });
        it("THEN Moc balance didn´t change", async function () {
          assertPrec(mocPrevACBalance, await mocFunctions.acBalanceOf(mocContracts.mocImpl.address));
        });
        it("THEN Moc Fee Flow balance increase 5.1% of 10 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec(10 * 0.051, diff);
        });
        it("THEN Moc Interest Collector balance increase 0.0987% of 10 AC", async function () {
          const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
          assertPrec("0.009877199074074070", diff);
        });
        it("THEN alice balance decrease 5.1% for Moc Fee Flow + 0.0987% for Moc Interest Collector of 100 Asset", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec("0.519877199074074070", diff);
        });
        it("THEN a TPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: Moc
          // qTP: 2350 TP
          // qAC: 10 AC - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector
          // qACfee: 5% AC
          // qACInterest: 0.0987% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPRedeemed")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocImpl.address,
              pEth(2350),
              pEth("9.490122800925925930"),
              pEth(10 * 0.05),
              pEth("0.009877199074074070"),
            );
        });
        it("THEN a TPMinted event is emitted", async function () {
          // i: 1
          // sender: Moc
          // receiver: bob
          // qTP: 52.5 TP
          // qAC: 10 AC + 0.1% for Moc Fee Flow
          // qACfee: 0.1% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPMinted")
            .withArgs(TP_1, mocContracts.mocImpl.address, bob, pEth(52.5), pEth(10 * 1.001), pEth(10 * 0.001));
        });
      });
      describe("AND TP 0 revalues to 10.5", function () {
        /*
          nAC = 3100    
          nTP = 23500
          lckAC = 2238.09
          coverage = 1.38
        */
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 10.5);
        });
        describe("WHEN alice swap 2350 TP 0 for 1175 TP 1", function () {
          /*
            ctargemaTP0 = 5
            ctargemaTP1 = 4
          */
          beforeEach(async function () {
            coverageBefore = await mocContracts.mocImpl.getCglb();
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
            // go forward to a fixed block remaining for settlement to avoid unpredictability
            const bns = await mocContracts.mocSettlement.bns();
            await mineUpTo(bns.sub(fixedBlock));
            tx = await mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 2350, qTPmin: 1175 });
          });
          it("THEN coverage didn´t change", async function () {
            assertPrec(coverageBefore, await mocContracts.mocImpl.getCglb());
          });
          it("THEN alice balance decrease 5.1% for Moc Fee Flow + 0.0987% for Moc Interest Collector of 223.8 Asset", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = alicePrevACBalance.sub(aliceActualACBalance);
            assertPrec("11.635346836419752994", diff);
          });
          it("THEN Moc balance didn´t change", async function () {
            assertPrec(mocPrevACBalance, await mocFunctions.acBalanceOf(mocContracts.mocImpl.address));
          });
          it("THEN a TPRedeemed event is emitted", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: Moc
            // qTP: 2350 TP
            // qAC: 223.8 AC - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector
            // qACfee: 5% AC
            // qACInterest: 0.0987% AC
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TPRedeemed")
              .withArgs(
                TP_0,
                mocContracts.mocWrapper?.address || alice,
                mocContracts.mocImpl.address,
                pEth(2350),
                pEth("212.397986496913580338"),
                pEth("11.190476190476190476"),
                pEth("0.221061122134038709"),
              );
          });
          it("THEN a TPMinted event is emitted", async function () {
            // i: 1
            // sender: Moc
            // receiver: alice
            // qTP: 1175 TP
            // qAC: 223.8 AC + 0.1% for Moc Fee Flow
            // qACfee: 0.1% AC
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TPMinted")
              .withArgs(
                TP_1,
                mocContracts.mocImpl.address,
                alice,
                pEth(1175),
                pEth("224.033333333333333332"),
                pEth("0.223809523809523809"),
              );
          });
        });
        describe("WHEN alice swap 2350 TP 0 for 1175 TP 4", function () {
          /*
            ctargemaTP0 = 5
            ctargemaTP4 = 6
          */
          it("THEN tx reverts because low coverage, ctargmeaTP4 > ctargemaTP0", async function () {
            await expect(
              mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_4, from: alice, qTP: 2350, qTPmin: 1175 }),
            ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.LOW_COVERAGE);
          });
        });
      });
      describe("AND TP 0 devalues to 47000", function () {
        /*
          nAC = 3100    
          nTP = 23500
          lckAC = 0.5
          coverage = 6200
        */
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 47000);
        });
        describe("WHEN alice swap 23500 TP 0 for 2.625 TP 1", function () {
          /*
            ctargemaTP0 = 5
            ctargemaTP1 = 4
          */
          beforeEach(async function () {
            coverageBefore = await mocContracts.mocImpl.getCglb();
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
            // go forward to a fixed block remaining for settlement to avoid unpredictability
            const bns = await mocContracts.mocSettlement.bns();
            await mineUpTo(bns.sub(fixedBlock));
            tx = await mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 23500, qTPmin: 2.625 });
          });
          it("THEN coverage didn´t change", async function () {
            assertPrec(coverageBefore, await mocContracts.mocImpl.getCglb());
          });
          it("THEN alice balance decrease 5.1% for Moc Fee Flow + 0.0987% for Moc Interest Collector of 0.5 Asset", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = alicePrevACBalance.sub(aliceActualACBalance);
            assertPrec("0.025993859953703703", diff);
          });
          it("THEN Moc balance didn´t change", async function () {
            assertPrec(mocPrevACBalance, await mocFunctions.acBalanceOf(mocContracts.mocImpl.address));
          });
          it("THEN a TPRedeemed event is emitted", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: Moc
            // qTP: 23500 TP
            // qAC: 0.5 AC - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector
            // qACfee: 5% AC
            // qACInterest: 0.0987% AC
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TPRedeemed")
              .withArgs(
                TP_0,
                mocContracts.mocWrapper?.address || alice,
                mocContracts.mocImpl.address,
                pEth(23500),
                pEth("0.474506140046296297"),
                pEth(0.5 * 0.05),
                pEth("0.000493859953703703"),
              );
          });
          it("THEN a TPMinted event is emitted", async function () {
            // i: 1
            // sender: Moc
            // receiver: alice
            // qTP: 2.625 TP
            // qAC: 0.5 AC + 0.1% for Moc Fee Flow
            // qACfee: 0.1% AC
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TPMinted")
              .withArgs(TP_1, mocContracts.mocImpl.address, alice, pEth(2.625), pEth("0.5005"), pEth("0.0005"));
          });
        });
        describe("WHEN alice swap 2350 TP 0 for 0.2625 TP 4", function () {
          /*
            ctargemaTP0 = 5
            ctargemaTP4 = 6
          */
          beforeEach(async function () {
            coverageBefore = await mocContracts.mocImpl.getCglb();
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            mocPrevACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
            // go forward to a fixed block remaining for settlement to avoid unpredictability
            const bns = await mocContracts.mocSettlement.bns();
            await mineUpTo(bns.sub(fixedBlock));
            tx = await mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_4, from: alice, qTP: 2350, qTPmin: "0.2625" });
          });
          it("THEN coverage didn´t change", async function () {
            assertPrec(coverageBefore, await mocContracts.mocImpl.getCglb());
          });
          it("THEN alice balance decrease 5.1% for Moc Fee Flow + 0.0987% for Moc Interest Collector of 0.05 Asset", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = alicePrevACBalance.sub(aliceActualACBalance);
            assertPrec("0.002599385995370370", diff);
          });
          it("THEN Moc balance didn´t change", async function () {
            assertPrec(mocPrevACBalance, await mocFunctions.acBalanceOf(mocContracts.mocImpl.address));
          });
          it("THEN a TPRedeemed event is emitted", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: Moc
            // qTP: 2350 TP
            // qAC: 0.05 AC - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector
            // qACfee: 5% AC
            // qACInterest: 0.0987% AC
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TPRedeemed")
              .withArgs(
                TP_0,
                mocContracts.mocWrapper?.address || alice,
                mocContracts.mocImpl.address,
                pEth(2350),
                pEth("0.047450614004629630"),
                pEth("0.0025"),
                pEth("0.000049385995370370"),
              );
          });
          it("THEN a TPMinted event is emitted", async function () {
            // i: 4
            // sender: Moc
            // receiver: alice
            // qTP: 0.2625 TP
            // qAC: 0.05 AC + 0.1% for Moc Fee Flow
            // qACfee: 0.1% AC
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TPMinted")
              .withArgs(TP_4, mocContracts.mocImpl.address, alice, pEth("0.2625"), pEth("0.05005"), pEth("0.00005"));
          });
        });
      });
    });
  });
};

export { swapTPforTPBehavior };
