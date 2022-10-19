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

  let coverageBefore: BigNumber;
  let tcPriceBefore: BigNumber;
  let tcLeverageBefore: BigNumber;
  let alicePrevTCBalance: Balance;
  let alicePrevTPBalance: Balance;
  let alicePrevACBalance: Balance;
  let bobPrevACBalance: Balance;
  let mocPrevACBalance: Balance;
  let mocFeeFlowPrevACBalance: Balance;
  let mocInterestCollectorPrevACBalance: Balance;
  let initializeBeforeData: () => Promise<void>;

  describe("Feature: redeem Pegged Token", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ alice, bob } = await getNamedAccounts());
      initializeBeforeData = async function () {
        [
          coverageBefore,
          tcPriceBefore,
          tcLeverageBefore,
          alicePrevTCBalance,
          alicePrevTPBalance,
          alicePrevACBalance,
          bobPrevACBalance,
          mocPrevACBalance,
          mocFeeFlowPrevACBalance,
          mocInterestCollectorPrevACBalance,
        ] = await Promise.all([
          mocContracts.mocImpl.getCglb(),
          mocContracts.mocImpl.getPTCac(),
          mocContracts.mocImpl.getLeverageTC(),
          mocFunctions.tcBalanceOf(alice),
          mocFunctions.tpBalanceOf(TP_0, alice),
          mocFunctions.assetBalanceOf(alice),
          mocFunctions.assetBalanceOf(bob),
          mocFunctions.acBalanceOf(mocContracts.mocImpl.address),
          mocFunctions.acBalanceOf(mocFeeFlowAddress),
          mocFunctions.acBalanceOf(mocInterestCollectorAddress),
        ]);
      };
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
      describe("WHEN alice tries to redeem a non-existent TP", function () {
        it("THEN tx reverts with panic code 0x32 array out of bounded", async function () {
          // generic revert because on collateral bag implementation fail before accessing the tp array
          await expect(mocFunctions.redeemTCandTP({ i: TP_NON_EXISTENT, from: alice, qTC: 100, qTP: 23500 })).to.be
            .reverted;
        });
      });
      describe("WHEN alice tries to redeem 0 TP", function () {
        it("THEN tx reverts because the amount of TP is invalid", async function () {
          await expect(
            mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 0 }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.INVALID_VALUE);
        });
      });
      describe("WHEN alice tries to redeem 0 TC", function () {
        it("THEN tx reverts because the amount of TC is invalid", async function () {
          await expect(
            mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 0, qTP: 23500 }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.INVALID_VALUE);
        });
      });
      describe("WHEN alice tries to redeem 100 TC and 23500 TP to the zero address", function () {
        it("THEN tx reverts because recipient is the zero address", async function () {
          await expect(
            mocFunctions.redeemTCandTPto({ i: TP_0, from: alice, to: CONSTANTS.ZERO_ADDRESS, qTC: 100, qTP: 23500 }),
          ).to.be.reverted;
        });
      });
      describe("WHEN alice tries to redeem 3001 TC and 2350000 TP", function () {
        it("THEN tx reverts because alice doesn't have that much TC and TP", async function () {
          await expect(mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 3001, qTP: 2350000 })).to.be.reverted;
        });
      });
      describe("WHEN alice redeems 100 TC and 723500 TP expecting 98.17 Asset", function () {
        it("THEN tx reverts because Asset received is below the minimum required", async function () {
          await expect(
            mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500, qACmin: 98.17 }),
          ).to.be.revertedWithCustomError(mocContracts.mocImpl, ERRORS.QAC_BELOW_MINIMUM);
        });
      });
      describe("WHEN alice redeems 100 TC and 783.33 TP (exactly amount of TP)", function () {
        /*
            nAC = 3100
            lckAC = 100
            coverage = 31
            pTCac = 1
            => to redeem 100 TC we use 783.3 TP
            => AC redeemed = 100 AC - 5% + 3.33AC - 5% - 0.0987% = 98.16
        */
        let tx: ContractTransaction;
        beforeEach(async function () {
          await initializeBeforeData();
          // go forward to a fixed block remaining for settlement to avoid unpredictability
          const bns = await mocContracts.mocSettlement.bns();
          await mineUpTo(bns.sub(fixedBlock));
          tx = await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: "783.333333333333333333" });
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
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = aliceActualACBalance.sub(alicePrevACBalance);
          assertPrec("98.163374266975308644", diff);
        });
        it("THEN Moc balance decrease 103.33 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          const diff = mocPrevACBalance.sub(mocActualACBalance);
          assertPrec("103.333333333333333333", diff);
        });
        it("THEN Moc Fee Flow balance increase 5% of 100 AC + 5% of 3.33 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec("5.166666666666666666", diff);
        });
        it("THEN Moc Interest Collector balance increase 0.0987% of 3.33 AC", async function () {
          const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
          assertPrec("0.003292399691358023", diff);
        });
        it("THEN a TCRedeemed event is emitted", async function () {
          // sender: alice || mocWrapper
          // receiver: alice || mocWrapper
          // qTC: 100 TC
          // qAC: 100 AC - 5% for Moc Fee Flow
          // qACfee: 5% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TCRedeemed")
            .withArgs(
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || alice,
              pEth(100),
              pEth(100 * 0.95),
              pEth(100 * 0.05),
            );
        });
        it("THEN a TPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: alice || mocWrapper
          // qTP: 783.33 TP
          // qAC: 3.33 AC - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector
          // qACfee: 5% AC
          // qACInterest: 0.0987% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPRedeemed")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || alice,
              pEth("783.333333333333333333"),
              pEth("3.163374266975308644"),
              pEth("0.166666666666666666"),
              pEth("0.003292399691358023"),
            );
        });
        it("THEN a Collateral Token Transfer event is emitted", async function () {
          // from: alice || mocWrapper
          // to: Zero Address
          // amount: 100 TC
          await expect(tx)
            .to.emit(mocContracts.mocCollateralToken, "Transfer")
            .withArgs(mocContracts.mocWrapper?.address || alice, CONSTANTS.ZERO_ADDRESS, pEth(100));
        });
        it("THEN a Pegged Token Transfer event is emitted", async function () {
          // from: alice || mocWrapper
          // to: Zero Address
          // amount: 783.33 TP
          await expect(tx)
            .to.emit(mocContracts.mocPeggedTokens[TP_0], "Transfer")
            .withArgs(
              mocContracts.mocWrapper?.address || alice,
              CONSTANTS.ZERO_ADDRESS,
              pEth("783.333333333333333333"),
            );
        });
      });
      describe("WHEN alice redeems 100 TC and 23500 TP (more amount of TP) to bob", function () {
        /*
            nAC = 3100
            lckAC = 100
            coverage = 31
            pTCac = 1
            => to redeem 100 TC we use 783.3 TP
            => AC redeemed = 100 AC - 5% + 3.33AC - 5% - 0.0987% = 98.16
        */
        let tx: ContractTransaction;
        beforeEach(async function () {
          await initializeBeforeData();
          // go forward to a fixed block remaining for settlement to avoid unpredictability
          const bns = await mocContracts.mocSettlement.bns();
          await mineUpTo(bns.sub(fixedBlock));
          tx = await mocFunctions.redeemTCandTPto({ i: TP_0, from: alice, to: bob, qTC: 100, qTP: 23500 });
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
        it("THEN bob AC balance increase 98.16 AC", async function () {
          const bobActualACBalance = await mocFunctions.assetBalanceOf(bob);
          const diff = bobActualACBalance.sub(bobPrevACBalance);
          assertPrec("98.163374266975308644", diff);
        });
        it("THEN Moc balance decrease 103.33 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          const diff = mocPrevACBalance.sub(mocActualACBalance);
          assertPrec("103.333333333333333333", diff);
        });
        it("THEN Moc Fee Flow balance increase 5% of 100 AC + 5% of 3.33 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec("5.166666666666666666", diff);
        });
        it("THEN Moc Interest Collector balance increase 0.0987% of 3.33 AC", async function () {
          const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
          assertPrec("0.003292399691358023", diff);
        });
        it("THEN a TCRedeemed event is emitted", async function () {
          // sender: alice || mocWrapper
          // receiver: bob || mocWrapper
          // qTC: 100 TC
          // qAC: 100 AC - 5% for Moc Fee Flow
          // qACfee: 5% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TCRedeemed")
            .withArgs(
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || bob,
              pEth(100),
              pEth(100 * 0.95),
              pEth(100 * 0.05),
            );
        });
        it("THEN a TPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: bob || mocWrapper
          // qTP: 783.33 TP
          // qAC: 3.33 AC - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector
          // qACfee: 5% AC
          // qACInterest: 0.0987% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPRedeemed")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || bob,
              pEth("783.333333333333333333"),
              pEth("3.163374266975308644"),
              pEth("0.166666666666666666"),
              pEth("0.003292399691358023"),
            );
        });
      });
      describe("WHEN alice redeems 1000 TC and 783.33 TP (less amount of TP)", function () {
        /*
            nAC = 3100
            lckAC = 100
            coverage = 31
            pTCac = 1
            => to redeem 100 TC we use 783.3 TP
            => AC redeemed = 100 AC - 5% + 3.33AC - 5% - 0.0987% = 98.16
        */
        let tx: ContractTransaction;
        beforeEach(async function () {
          await initializeBeforeData();
          // go forward to a fixed block remaining for settlement to avoid unpredictability
          const bns = await mocContracts.mocSettlement.bns();
          await mineUpTo(bns.sub(fixedBlock));
          tx = await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 1000, qTP: "783.333333333333333334" });
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
          assertPrec("783.333333333333333334", diff);
        });
        it("THEN alice AC balance increase 98.16 AC", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = aliceActualACBalance.sub(alicePrevACBalance);
          assertPrec("98.163374266975308644", diff);
        });
        it("THEN Moc balance decrease 103.33 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
          const diff = mocPrevACBalance.sub(mocActualACBalance);
          assertPrec("103.333333333333333333", diff);
        });
        it("THEN Moc Fee Flow balance increase 5% of 100 AC + 5% of 3.33 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec("5.166666666666666666", diff);
        });
        it("THEN Moc Interest Collector balance increase 0.0987% of 3.33 AC", async function () {
          const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
          const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
          assertPrec("0.003292399691358023", diff);
        });
        it("THEN a TCRedeemed event is emitted", async function () {
          // sender: alice || mocWrapper
          // receiver: alice || mocWrapper
          // qTC: 100 TC
          // qAC: 100 AC - 5% for Moc Fee Flow
          // qACfee: 5% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TCRedeemed")
            .withArgs(
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || alice,
              pEth(100),
              pEth(100 * 0.95),
              pEth(100 * 0.05),
            );
        });
        it("THEN a TPRedeemed event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: alice || mocWrapper
          // qTP: 783.33 TP
          // qAC: 3.33 AC - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector
          // qACfee: 5% AC
          // qACInterest: 0.0987% AC
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TPRedeemed")
            .withArgs(
              TP_0,
              mocContracts.mocWrapper?.address || alice,
              mocContracts.mocWrapper?.address || alice,
              pEth("783.333333333333333334"),
              pEth("3.163374266975308644"),
              pEth("0.166666666666666666"),
              pEth("0.003292399691358023"),
            );
        });
      });
      describe("AND TP 0 revalues to 10 making TC price to change and protocol to be in low coverage", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 10);
        });
        describe("WHEN alice redeems 100 TC and 23500 TP (more amount of TP)", function () {
          /*
            nAC = 3100
            lckAC = 2350
            coverage = 1.319
            pTCac = 0.25
            => to redeem 100 TC we use 783.33 TP
            => AC redeemed = 25 AC - 5% + 78.33AC - 5% - 0.0987% = 98.08
          */
          let tx: ContractTransaction;
          beforeEach(async function () {
            await initializeBeforeData();
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
            assertPrec("783.333333333333335683", diff);
          });
          it("THEN alice AC balance increase 98.08 AC", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = aliceActualACBalance.sub(alicePrevACBalance);
            assertPrec("98.089295273919753342", diff);
          });
          it("THEN Moc balance decrease 103.33 AC", async function () {
            const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
            const diff = mocPrevACBalance.sub(mocActualACBalance);
            assertPrec("103.333333333333333568", diff);
          });
          it("THEN Moc Fee Flow balance increase 5% of 25 AC + 5% of 78.33 AC", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
            const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
            assertPrec("5.166666666666666678", diff);
          });
          it("THEN Moc Interest Collector balance increase 0.0987% of 78.33 AC", async function () {
            const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
            const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
            assertPrec("0.077371392746913548", diff);
          });
          it("THEN a TCRedeemed event is emitted", async function () {
            // sender: alice || mocWrapper
            // receiver: alice || mocWrapper
            // qTC: 100 TC
            // qAC: 25 AC - 5% for Moc Fee Flow
            // qACfee: 5% AC
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TCRedeemed")
              .withArgs(
                mocContracts.mocWrapper?.address || alice,
                mocContracts.mocWrapper?.address || alice,
                pEth(100),
                pEth(25 * 0.95),
                pEth(25 * 0.05),
              );
          });
          it("THEN a TPRedeemed event is emitted", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: alice || mocWrapper
            // qTP: 783.33 TP
            // qAC: 78.33 AC - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector
            // qACfee: 5% AC
            // qACInterest: 0.0987% AC
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TPRedeemed")
              .withArgs(
                TP_0,
                mocContracts.mocWrapper?.address || alice,
                mocContracts.mocWrapper?.address || alice,
                pEth("783.333333333333335683"),
                pEth("74.339295273919753342"),
                pEth("3.916666666666666678"),
                pEth("0.077371392746913548"),
              );
          });
        });
        describe("WHEN alice redeems 1000 TC and 783.33 TP (less amount of TP)", function () {
          /*
            nAC = 3100
            lckAC = 2350
            coverage = 1.319
            pTCac = 0.25
            => to redeem 99.9 TC we use 783.33 TP
            => AC redeemed = 25 AC - 5% + 78.33AC - 5% - 0.0987% = 98.08
          */
          let tx: ContractTransaction;
          beforeEach(async function () {
            await initializeBeforeData();
            // go forward to a fixed block remaining for settlement to avoid unpredictability
            const bns = await mocContracts.mocSettlement.bns();
            await mineUpTo(bns.sub(fixedBlock));
            tx = await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 1000, qTP: "783.333333333333333334" });
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
          it("THEN alice TC balance decrease 99.9 TC", async function () {
            const aliceActualTCBalance = await mocFunctions.tcBalanceOf(alice);
            const diff = alicePrevTCBalance.sub(aliceActualTCBalance);
            assertPrec("99.9999999999999997", diff);
          });
          it("THEN alice TP balance decrease 783.33 TP", async function () {
            const aliceActualTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
            const diff = alicePrevTPBalance.sub(aliceActualTPBalance);
            assertPrec("783.333333333333333334", diff);
          });
          it("THEN alice AC balance increase 98.08 AC", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = aliceActualACBalance.sub(alicePrevACBalance);
            assertPrec("98.089295273919753048", diff);
          });
          it("THEN Moc balance decrease 103.33 AC", async function () {
            const mocActualACBalance = await mocFunctions.acBalanceOf(mocContracts.mocImpl.address);
            const diff = mocPrevACBalance.sub(mocActualACBalance);
            assertPrec("103.333333333333333258", diff);
          });
          it("THEN Moc Fee Flow balance increase 5% of 25 AC + 5% of 78.33 AC", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
            const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
            assertPrec("5.166666666666666662", diff);
          });
          it("THEN Moc Interest Collector balance increase 0.0987% of 78.33 AC", async function () {
            const mocInterestCollectorActualACBalance = await mocFunctions.acBalanceOf(mocInterestCollectorAddress);
            const diff = mocInterestCollectorActualACBalance.sub(mocInterestCollectorPrevACBalance);
            assertPrec("0.077371392746913548", diff);
          });
          it("THEN a TCRedeemed event is emitted", async function () {
            // sender: alice || mocWrapper
            // receiver: alice || mocWrapper
            // qTC: 99.9 TC
            // qAC: 25 AC - 5% for Moc Fee Flow
            // qACfee: 5% AC
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TCRedeemed")
              .withArgs(
                mocContracts.mocWrapper?.address || alice,
                mocContracts.mocWrapper?.address || alice,
                pEth("99.9999999999999997"),
                pEth("23.749999999999999929"),
                pEth("1.249999999999999996"),
              );
          });
          it("THEN a TPRedeemed event is emitted", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: alice || mocWrapper
            // qTP: 783.33 TP
            // qAC: 78.33 AC - 5% for Moc Fee Flow - 0.0987% for Moc Interest Collector
            // qACfee: 5% AC
            // qACInterest: 0.0987% AC
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TPRedeemed")
              .withArgs(
                TP_0,
                mocContracts.mocWrapper?.address || alice,
                mocContracts.mocWrapper?.address || alice,
                pEth("783.333333333333333334"),
                pEth("74.339295273919753119"),
                pEth("3.916666666666666666"),
                pEth("0.077371392746913548"),
              );
          });
        });
      });
    });
  });
};

export { redeemTCandTPBehavior };
