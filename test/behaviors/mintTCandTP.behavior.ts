import hre, { getNamedAccounts, ethers } from "hardhat";
import { BigNumber, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { beforeEach } from "mocha";
import { assertPrec } from "../helpers/assertHelper";
import { Balance, ERRORS, pEth, CONSTANTS, expectEventFor } from "../helpers/utils";
import { getNetworkDeployParams } from "../../scripts/utils";
import { MocCACoinbase, MocCARC20 } from "../../typechain";

const mintTCandTPBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let alice: Address;
  let bob: Address;
  let operator: Address;
  let vendor: Address;
  let expectEvent: any;
  let tps: Address[];
  const noVendor = CONSTANTS.ZERO_ADDRESS;
  let tx: ContractTransaction;
  const TP_0 = 0;
  const TP_1 = 1;
  const TP_4 = 4;

  const { mocFeeFlowAddress } = getNetworkDeployParams(hre).mocAddresses;

  describe("Feature: joint Mint TC and TP operation", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ mocImpl } = mocContracts);
      ({ alice, bob, vendor } = await getNamedAccounts());
      operator = mocContracts.mocWrapper?.address || alice;
      expectEvent = expectEventFor(mocImpl, mocFunctions, "TCandTPMinted");
      tps = mocContracts.mocPeggedTokens.map((it: any) => it.address);
    });
    describe("GIVEN the protocol is empty", function () {
      describe("WHEN alice asks for 2350 TP using mintTCandTP", function () {
        /*
          nAC = 0
          lckAC = 0
          coverage = 41.266
          pTCac = 1
          ctargemaCA = 4
          qTC = 45.41 TC
          qAC = 45.41 AC + 10 AC + 8% for Moc Fee Flow
          coverage = (0 + 55.41) / 10  
        */
        beforeEach(async function () {
          tx = await mocFunctions.mintTCandTP({ from: alice, qTP: 2350 });
        });
        it("THEN coverage goes to 5.54, ctargemaTP 0 value", async function () {
          assertPrec(pEth("5.541407281644972646"), await mocImpl.getCglb());
        });
        it("THEN a TCandTPMinted event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: alice
          // qTC: 45.41 TC
          // qTP: 2350 TP
          // qAC: 45.41 AC + 10 AC + 8% for Moc Fee Flow
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          const args = [
            tps[TP_0],
            operator,
            alice,
            pEth("45.414072816449726460"),
            pEth(2350),
            pEth("59.847198641765704576"),
            pEth("4.433125825315978116"),
            0,
            0,
            0,
            noVendor,
          ];
          await expectEvent(tx, args);
        });
      });
    });
    describe("GIVEN alice has 3000 TC, 23500 TP 0", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 3000 });
        await mocFunctions.mintTP({ from: alice, qTP: 23500 });
      });
      describe("WHEN alice sends 59.84(less amount) AC to mint 2350 TP", function () {
        it("THEN tx reverts because the amount of AC is insufficient", async function () {
          await expect(
            mocFunctions.mintTCandTP({ from: alice, qTP: 2350, qACmax: "59.847198641765704575" }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.INSUFFICIENT_QAC_SENT);
        });
      });
      describe("WHEN alice tries to mint 1 wei TP", function () {
        it("THEN tx reverts because the amount of TP is too low and out of precision", async function () {
          await expect(
            mocFunctions.mintTCandTP({ from: alice, qTP: 1, applyPrecision: false }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO);
        });
      });
      describe("WHEN alice sends 59.84(exactly amount) AC to mint 2350 TP", function () {
        /*
        nAC = 3100    
        nTP = 23500
        lckAC = 100 
        ctargemaCA = 5.54
        qTC = 45.4 TC
        qAC = 45.4 AC + 10 AC + 8% for Moc Fee Flow
        coverage = (3100 + 54.4) / 110  
        */
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
            mocImpl.getPTCac(),
            mocFunctions.tcBalanceOf(alice),
            mocFunctions.tpBalanceOf(TP_0, alice),
            mocFunctions.assetBalanceOf(alice),
            mocFunctions.acBalanceOf(mocImpl.address),
            mocFunctions.acBalanceOf(mocFeeFlowAddress),
          ]);
          tx = await mocFunctions.mintTCandTP({ from: alice, qTP: 2350, qACmax: "59.847198641765704576" });
        });
        it("THEN coverage is still above ctargemaCA", async function () {
          expect(await mocImpl.getCglb()).to.be.greaterThanOrEqual(await mocImpl.calcCtargemaCA());
        });
        it("THEN coverage decrease to 28.68", async function () {
          assertPrec("28.685582480149542967", await mocImpl.getCglb());
        });
        it("THEN TC price did not change", async function () {
          assertPrec(tcPriceBefore, await mocImpl.getPTCac());
        });
        it("THEN alice TC balance increase 45.41 TC", async function () {
          const aliceActualTCBalance = await mocFunctions.tcBalanceOf(alice);
          const diff = aliceActualTCBalance.sub(alicePrevTCBalance);
          assertPrec("45.414072816449726460", diff);
        });
        it("THEN alice TP balance increase 2350 TP", async function () {
          const aliceActualTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          const diff = aliceActualTPBalance.sub(alicePrevTPBalance);
          assertPrec(2350, diff);
        });
        it("THEN alice AC balance decrease 59.84 AC", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec("59.847198641765704576", diff);
        });
        it("THEN Moc balance increase 55.41 AC", async function () {
          const mocActualACBalance = await mocFunctions.acBalanceOf(mocImpl.address);
          const diff = mocActualACBalance.sub(mocPrevACBalance);
          assertPrec("55.414072816449726460", diff);
        });
        it("THEN Moc Fee Flow balance increase 8% of 45.4 AC + 8% of 10 AC", async function () {
          const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          const diff = mocFeeFlowActualACBalance.sub(mocFeeFlowPrevACBalance);
          assertPrec("4.433125825315978116", diff);
        });
        it("THEN a TCandTPMinted event is emitted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: alice
          // qTC: 45.41 TC
          // qTP: 2350 TP
          // qAC: 45.4 AC + 10 AC + 8% for Moc Fee Flow
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[0],
            operator,
            alice,
            pEth("45.414072816449726460"),
            pEth(2350),
            pEth("59.847198641765704576"),
            pEth("4.433125825315978116"),
            0,
            0,
            0,
            noVendor,
          ]);
        });
        it("THEN a Collateral Token Transfer event is emitted", async function () {
          // from: Zero Address
          // to: alice
          // amount: 100 TC
          await expect(tx)
            .to.emit(mocContracts.mocCollateralToken, "Transfer")
            .withArgs(CONSTANTS.ZERO_ADDRESS, alice, pEth("45.414072816449726460"));
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
      describe("WHEN alice sends 589.8(exceeded amount) AC to mint 2350 TP to bob", function () {
        /*
        nAC = 3100    
        nTP = 23500
        lckAC = 100 
        ctargemaCA = 5.54
        qTC = 45.4 TC
        qAC = 45.4 AC + 10 AC + 8% for Moc Fee Flow
        coverage = (3100 + 54.4) / 110  
        */
        beforeEach(async function () {
          tx = await mocFunctions.mintTCandTP({ from: alice, to: bob, qTP: 2350 });
        });
        it("THEN bob TC balance increase 45.41 TC", async function () {
          assertPrec("45.414072816449726460", await mocFunctions.tcBalanceOf(bob));
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
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[0],
            operator,
            bob,
            pEth("45.414072816449726460"),
            pEth(2350),
            pEth("59.847198641765704576"),
            pEth("4.433125825315978116"),
            0,
            0,
            0,
            noVendor,
          ]);
        });
      });
      describe("WHEN alice mints 45.41 TC and 2350 TP via vendor", function () {
        let alicePrevACBalance: Balance;
        let vendorPrevACBalance: Balance;
        beforeEach(async function () {
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          vendorPrevACBalance = await mocFunctions.acBalanceOf(vendor);
          tx = await mocFunctions.mintTCandTP({ from: alice, qTP: 2350, vendor });
        });
        it("THEN alice AC balance decrease 65.38 Asset (54.4 qAC + 8% qACFee + 10% qACVendorMarkup)", async function () {
          const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
          const diff = alicePrevACBalance.sub(aliceActualACBalance);
          assertPrec("65.388605923410677222", diff);
        });
        it("THEN vendor AC balance increase 5.54 Asset", async function () {
          const vendorActualACBalance = await mocFunctions.acBalanceOf(vendor);
          const diff = vendorActualACBalance.sub(vendorPrevACBalance);
          assertPrec("5.541407281644972646", diff);
        });
        it("THEN a TCandTPMinted event is emitted", async function () {
          // i : 0
          // sender: alice || mocWrapper
          // receiver: alice
          // qTC: 45.41 TC
          // qAC: 45.4 AC + 10 AC + 8% for Moc Fee Flow + 10% for vendor
          // qACfee: 8% qAC
          // qFeeToken: 0
          // qACVendorMarkup: 10% qAC
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[0],
            operator,
            alice,
            pEth("45.414072816449726460"),
            pEth(2350),
            pEth("65.388605923410677222"),
            pEth("4.433125825315978116"),
            0,
            pEth("5.541407281644972646"),
            0,
            vendor,
          ]);
        });
      });
      describe("WHEN alice mints 45.41 TC and 2350 TP to bob via vendor", function () {
        beforeEach(async function () {
          tx = await mocFunctions.mintTCandTP({ from: alice, to: bob, qTP: 2350, vendor });
        });
        it("THEN a TCandTPMinted event is emitted", async function () {
          // i : 0
          // sender: alice || mocWrapper
          // receiver: bob
          // qTC: 45.41 TC
          // qAC: 45.4 AC + 10 AC + 8% for Moc Fee Flow + 10% for vendor
          // qACfee: 8% qAC
          // qFeeToken: 0
          // qACVendorMarkup: 10% qAC
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[0],
            operator,
            bob,
            pEth("45.414072816449726460"),
            pEth(2350),
            pEth("65.388605923410677222"),
            pEth("4.433125825315978116"),
            0,
            pEth("5.541407281644972646"),
            0,
            vendor,
          ]);
        });
      });
      describe("AND TP 0 revalues to 10 making TC price to drop and protocol to be in low coverage", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 10);
        });
        describe("WHEN alice mints 23500 TP", function () {
          /*
            nAC = 3100
            lckAC = 2350
            coverage = 1.319
            pTCac = 0.25
            ctargemaCA = 5
            qTC = 37600 TC
            qAC = 9400 AC + 2350 AC + 8% for Moc Fee Flow
            coverage = (3100 + 11750) / 4700  
          */
          beforeEach(async function () {
            tx = await mocFunctions.mintTCandTP({ from: alice, qTP: 23500 });
          });
          it("THEN coverage increase to 3.15", async function () {
            assertPrec("3.159574468085106382", await mocImpl.getCglb());
          });
          it("THEN a TCandTPMinted event is emitted", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: alice
            // qTC: 37600 TC
            // qTP: 23500 TP
            // qAC: 9400 AC + 2350 AC + 8% for Moc Fee Flow
            // qACfee: 8% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            const args = [tps[0], operator, alice, pEth(37600), pEth(23500), pEth(12690), pEth(940), 0, 0, 0, noVendor];
            await expectEvent(tx, args);
          });
        });
      });
      describe("AND TP 0 devaluates to 470 making TC price to rise", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, 470);
        });
        describe("WHEN alice mints 23500 TP", function () {
          /*
            nAC = 3100
            lckAC = 50 + 25(tpGain)
            nACgain = 5
            coverage = 41.266
            pTCac = 1.0066
            ctargemaCA = 11.08
            qTC = 500.8 TC
            qAC = 504.14 AC + 50 AC + 8% for Moc Fee Flow
            coverage = (3100 + 554.14) / 125  
          */
          beforeEach(async function () {
            tx = await mocFunctions.mintTCandTP({ from: alice, qTP: 23500 });
          });
          it("THEN coverage decrease to 29.19", async function () {
            assertPrec("29.193125825315978117", await mocImpl.getCglb());
          });
          it("THEN a TCandTPMinted event is emitted", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: alice
            // qTC: 500.08 TC
            // qTP: 23500 TP
            // qAC: 9400 AC + 2350 AC + 8% for Moc Fee Flow
            // qACfee: 8% AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[0],
              operator,
              alice,
              pEth("500.802047845527084421"),
              pEth(23500),
              pEth("598.471986417657045822"),
              pEth("44.331258253159781172"),
              0,
              0,
              0,
              noVendor,
            ]);
          });
        });
      });
      describe("AND Pegged Token has been revaluated making lckAC bigger than total AC in the protocol", function () {
        // this test is to check that tx doesn't fail because underflow doing totalACAvailable - lckAC
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, "0.00000001");
        });
        it("THEN tx reverts because coverage is below the protected threshold", async function () {
          expect((await mocImpl.getCglb()) < pEth(1)); // check that lckAC > totalACAvailable
          await expect(mocFunctions.mintTCandTP({ from: alice, qTP: 23500 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.LOW_COVERAGE,
          );
        });
      });
      describe("AND alice has FeeToken to pay fees", function () {
        let alicePrevACBalance: Balance;
        let alicePrevFeeTokenBalance: Balance;
        let mocFeeFlowPrevACBalance: Balance;
        let mocFeeFlowPrevFeeTokenBalance: Balance;
        beforeEach(async function () {
          // mint FeeToken to alice
          await mocContracts.feeToken.mint(alice, pEth(50));
          await mocContracts.feeToken.connect(await ethers.getSigner(alice)).approve(mocImpl.address, pEth(50));

          // initialize previous balances
          alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
          alicePrevFeeTokenBalance = await mocContracts.feeToken.balanceOf(alice);
          mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
          mocFeeFlowPrevFeeTokenBalance = await mocContracts.feeToken.balanceOf(mocFeeFlowAddress);
        });
        describe("WHEN alice mints 45.41 TC and 2350 TP", function () {
          beforeEach(async function () {
            tx = await mocFunctions.mintTCandTP({ from: alice, qTP: 2350 });
          });
          it("THEN alice AC balance decrease 55.41 Asset", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = alicePrevACBalance.sub(aliceActualACBalance);
            assertPrec("55.414072816449726460", diff);
          });
          it("THEN alice Fee Token balance decrease 2.21 (55.41 * 8% * 50%)", async function () {
            const aliceActualFeeTokenBalance = await mocContracts.feeToken.balanceOf(alice);
            const diff = alicePrevFeeTokenBalance.sub(aliceActualFeeTokenBalance);
            assertPrec("2.216562912657989058", diff);
          });
          it("THEN Moc Fee Flow AC balance doesn't change", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
            assertPrec(mocFeeFlowActualACBalance, mocFeeFlowPrevACBalance);
          });
          it("THEN Moc Fee Flow Fee Token balance increase 2.21 (55.41 * 8% * 50%)", async function () {
            const mocFeeFlowActualFeeTokenBalance = await mocContracts.feeToken.balanceOf(mocFeeFlowAddress);
            const diff = mocFeeFlowActualFeeTokenBalance.sub(mocFeeFlowPrevFeeTokenBalance);
            assertPrec("2.216562912657989058", diff);
          });
          it("THEN Fee Token is used as fee payment method", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: alice
            // qTC: 45.41 TC
            // qTP: 2350 TP
            // qAC: 45.4 AC + 10 AC
            // qACfee: 0 AC
            // qFeeToken: 55.4 (8% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[0],
              operator,
              alice,
              pEth("45.414072816449726460"),
              pEth(2350),
              pEth("55.414072816449726460"),
              0,
              pEth("2.216562912657989058"),
              0,
              0,
              noVendor,
            ]);
          });
        });
        describe("WHEN alice mints 45.41 TC and 2350 TP to bob", function () {
          beforeEach(async function () {
            tx = await mocFunctions.mintTCandTP({ from: alice, to: bob, qTP: 2350 });
          });
          it("THEN alice AC balance decrease 55.41 Asset", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = alicePrevACBalance.sub(aliceActualACBalance);
            assertPrec("55.414072816449726460", diff);
          });
          it("THEN alice Fee Token balance decrease 2.21 (55.41 * 8% * 50%)", async function () {
            const aliceActualFeeTokenBalance = await mocContracts.feeToken.balanceOf(alice);
            const diff = alicePrevFeeTokenBalance.sub(aliceActualFeeTokenBalance);
            assertPrec("2.216562912657989058", diff);
          });
          it("THEN Moc Fee Flow AC balance doesn't change", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
            assertPrec(mocFeeFlowActualACBalance, mocFeeFlowPrevACBalance);
          });
          it("THEN Moc Fee Flow Fee Token balance increase 2.21 (55.41 * 8% * 50%)", async function () {
            const mocFeeFlowActualFeeTokenBalance = await mocContracts.feeToken.balanceOf(mocFeeFlowAddress);
            const diff = mocFeeFlowActualFeeTokenBalance.sub(mocFeeFlowPrevFeeTokenBalance);
            assertPrec("2.216562912657989058", diff);
          });
          it("THEN Fee Token is used as fee payment method", async function () {
            // i: 0
            // sender: alice || mocWrapper
            // receiver: bob
            // qTC: 45.41 TC
            // qTP: 2350 TP
            // qAC: 45.4 AC + 10 AC
            // qACfee: 0 AC
            // qFeeToken: 55.4 (8% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            await expectEvent(tx, [
              tps[0],
              operator,
              bob,
              pEth("45.414072816449726460"),
              pEth(2350),
              pEth("55.414072816449726460"),
              0,
              pEth("2.216562912657989058"),
              0,
              0,
              noVendor,
            ]);
          });
        });
      });
      describe("WHEN alice mints 10000000000000 TP 0, which ctarg is the same than ctargemaCA", function () {
        beforeEach(async function () {
          // assert coverage is above ctargemaCA before the operation
          expect(await mocImpl.getCglb()).to.be.greaterThanOrEqual(await mocImpl.calcCtargemaCA());
          const qACmax = 300000000000;
          const qTP = 10000000000000;
          tx = await mocFunctions.mintTCandTP({ from: alice, qTP, qACmax });
        });
        it("THEN coverage is still above ctargemaCA", async function () {
          // coverage = 5.541407341472665393
          // ctargemaCA = 5.541407281644972646
          expect(await mocImpl.getCglb()).to.be.greaterThanOrEqual(await mocImpl.calcCtargemaCA());
        });
        it("THEN 193251373687.02 TC are minted", async function () {
          // i: 0
          // sender: alice || mocWrapper
          // receiver: alice
          // qTC: 193251373687.02 TC
          // qTP: 10000000000000 TP
          // qAC: 193251373687.02 AC + 42553191489.36 AC + 8% for Moc Fee Flow
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[0],
            operator,
            alice,
            pEth("193251373687.020112595744680851"),
            pEth("10000000000000.000000000000000000"),
            pEth("254668930390.492359901276595744"),
            pEth("18864365214.110545177872340425"),
            0,
            0,
            0,
            noVendor,
          ]);
        });
      });
      describe("WHEN alice mints 100000 TP 4, which ctarg is bigger than ctargemaCA", function () {
        beforeEach(async function () {
          // assert coverage is above ctargemaCA before the operation
          expect(await mocImpl.getCglb()).to.be.greaterThanOrEqual(await mocImpl.calcCtargemaCA());
          tx = await mocFunctions.mintTCandTP({ i: TP_4, from: alice, qTP: 100000 });
        });
        it("THEN coverage is still above ctargemaCA", async function () {
          // coverage = 6.379258890823178313
          // ctargemaCA = 6.246299316815355490
          expect(await mocImpl.getCglb()).to.be.greaterThanOrEqual(await mocImpl.calcCtargemaCA());
        });
        it("THEN 100000 TC are minted", async function () {
          // i: 4
          // sender: alice || mocWrapper
          // receiver: alice
          // qTC: 100000 TC
          // qTP: 100000 TP
          // qAC: 100000 AC + 19047.61 AC + 8% for Moc Fee Flow
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[TP_4],
            operator,
            alice,
            pEth("100000.000000000000000000"),
            pEth(100000),
            pEth("128571.428571428571428570"),
            pEth("9523.809523809523809523"),
            0,
            0,
            0,
            noVendor,
          ]);
        });
      });
      describe("WHEN alice mints 1000000 TP 1, which ctarg is lower than ctargemaCA", function () {
        beforeEach(async function () {
          // assert coverage is above ctargemaCA before the operation
          expect(await mocImpl.getCglb()).to.be.greaterThanOrEqual(await mocImpl.calcCtargemaCA());
          tx = await mocFunctions.mintTCandTP({ i: TP_1, from: alice, qTP: 1000000 });
        });
        it("THEN coverage is still above ctargemaCA", async function () {
          // coverage = 4.180746774609996417
          // ctargemaCA = 4.167388026775473153
          expect(await mocImpl.getCglb()).to.be.greaterThanOrEqual(await mocImpl.calcCtargemaCA());
        });
        it("THEN 603174.60 TC are minted", async function () {
          // i: 1
          // sender: alice || mocWrapper
          // receiver: alice
          // qTC: 603174.60 TC
          // qTP: 1000000 TP
          // qAC: 603174.60 AC + 190476.19 AC + 8% for Moc Fee Flow
          // qACfee: 8% AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expectEvent(tx, [
            tps[1],
            operator,
            alice,
            pEth("603174.603174603174476190"),
            pEth(1000000),
            pEth("857142.857142857142719999"),
            pEth("63492.063492063492053333"),
            0,
            0,
            0,
            noVendor,
          ]);
        });
      });
    });
  });
};

export { mintTCandTPBehavior };
