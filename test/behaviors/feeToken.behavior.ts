import { getNamedAccounts, ethers } from "hardhat";
import { ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { assertPrec } from "../helpers/assertHelper";
import { Balance, CONSTANTS, expectEventFor, pEth } from "../helpers/utils";
import { ERC20Mock, MocCACoinbase, MocCARC20, PriceProviderMock } from "../../typechain";

const feeTokenBehavior = function () {
  let mocImpl: MocCACoinbase | MocCARC20;
  let feeToken: ERC20Mock;
  let feeTokenPriceProvider: PriceProviderMock;
  let mocContracts: any;
  let mocFunctions: any;
  let alice: Address;
  let vendor: Address;
  let operator: Address;
  let tx: ContractTransaction;
  let expectTCMinted: any;
  let expectTCRedeemed: any;
  const noVendor = CONSTANTS.ZERO_ADDRESS;

  describe("Feature: Fee Token as fee payment method", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ alice, vendor } = await getNamedAccounts());
      ({ feeToken, feeTokenPriceProvider, mocImpl } = mocContracts);
      operator = alice;
      // give some TC to alice
      await mocFunctions.mintTC({ from: alice, qTC: 1000 });
      expectTCMinted = expectEventFor(mocImpl, mocFunctions, "TCMinted");
      expectTCRedeemed = expectEventFor(mocImpl, mocFunctions, "TCRedeemed");
    });
    describe("GIVEN alice has 50 Fee Token", function () {
      beforeEach(async function () {
        await feeToken.mint(alice, pEth(50));
      });
      describe("WHEN alice mints 100 TC without sending Fee Token approval", function () {
        beforeEach(async function () {
          tx = await mocFunctions.mintTC({ from: alice, qTC: 100 });
        });
        it("THEN a AC is used as fee payment method", async function () {
          // sender: alice
          // receiver: alice
          // qTC: 100 TC
          // qAC: 100 AC + 5% for Moc Fee Flow
          // qACfee: %5 AC
          // qFeeToken: 0
          // qACVendorMarkup: 0
          // qFeeTokenVendorMarkup: 0
          await expectTCMinted(tx, [operator, alice, pEth(100), pEth(105), pEth(5), 0, 0, 0, noVendor]);
        });
      });
      describe("AND alice approves 25 Fee Token to Moc Core", function () {
        beforeEach(async function () {
          await feeToken.connect(await ethers.getSigner(alice)).approve(mocImpl.address, pEth(25));
        });
        describe("WHEN alice mints 10000 TC and doesn't have enough Fee Token allowance", function () {
          beforeEach(async function () {
            await feeToken.mint(alice, pEth(10000));
            tx = await mocFunctions.mintTC({ from: alice, qTC: 10000 });
          });
          it("THEN a AC is used as fee payment method", async function () {
            // sender: alice
            // receiver: alice
            // qTC: 10000 TC
            // qAC: 10000 AC + 5% for Moc Fee Flow
            // qACfee: %5 AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            const args = [operator, alice, pEth(10000), pEth(10000 * 1.05), pEth(10000 * 0.05), 0, 0, 0, noVendor];
            await expectTCMinted(tx, args);
          });
        });
        describe("WHEN alice mints 10000 TC and doesn't have enough Fee Token balance", function () {
          beforeEach(async function () {
            await feeToken.connect(await ethers.getSigner(alice)).approve(mocImpl.address, pEth(10000));
            tx = await mocFunctions.mintTC({ from: alice, qTC: 10000 });
          });
          it("THEN a AC is used as fee payment method", async function () {
            // sender: alice
            // receiver: alice
            // qTC: 10000 TC
            // qAC: 10000 AC + 5% for Moc Fee Flow
            // qACfee: %5 AC
            // qFeeToken: 0
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            const args = [operator, alice, pEth(10000), pEth(10000 * 1.05), pEth(10000 * 0.05), 0, 0, 0, noVendor];
            await expectTCMinted(tx, args);
          });
        });
        describe("AND Fee Token price provider doesn't have a valid price", function () {
          beforeEach(async function () {
            await feeTokenPriceProvider.deprecatePriceProvider();
          });
          describe("WHEN alice mints 100 TC", function () {
            beforeEach(async function () {
              tx = await mocFunctions.mintTC({ from: alice, qTC: 100 });
            });
            it("THEN a AC is used as fee payment method", async function () {
              // sender: alice
              // receiver: alice
              // qTC: 100 TC
              // qAC: 100 AC + 5% for Moc Fee Flow
              // qACfee: %5 AC
              // qFeeToken: 0
              // qACVendorMarkup: 0
              // qFeeTokenVendorMarkup: 0
              const args = [operator, alice, pEth(100), pEth(100 * 1.05), pEth(100 * 0.05), 0, 0, 0, noVendor];
              await expectTCMinted(tx, args);
            });
          });
        });
        describe("WHEN alice mints 100 TC", function () {
          beforeEach(async function () {
            tx = await mocFunctions.mintTC({ from: alice, qTC: 100 });
          });
          it("THEN Fee Token is used as fee payment method", async function () {
            // sender: alice
            // receiver: alice
            // qTC: 100 TC
            // qAC: 100 AC
            // qACfee: 0 AC
            // qFeeToken: 100 AC (5% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            const args = [operator, alice, pEth(100), pEth(100), 0, pEth(100 * 0.05 * 0.5), 0, 0, noVendor];
            await expectTCMinted(tx, args);
          });
        });
        describe("WHEN alice redeems 100 TC", function () {
          beforeEach(async function () {
            tx = await mocFunctions.redeemTC({ from: alice, qTC: 100 });
          });
          it("THEN Fee Token is used as fee payment method", async function () {
            // sender: alice
            // receiver: alice
            // qTC: 100 TC
            // qAC: 100 AC
            // qACfee: 0 AC
            // qFeeToken: 100 AC (5% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 0
            const args = [operator, operator, pEth(100), pEth(100), 0, pEth(100 * 0.05 * 0.5), 0, 0, noVendor];
            await expectTCRedeemed(tx, args);
          });
        });
        describe("WHEN alice mints 100 TC via vendor", function () {
          let alicePrevFeeTokenBalance: Balance;
          let vendorPrevFeeTokenBalance: Balance;
          beforeEach(async function () {
            alicePrevFeeTokenBalance = await feeToken.balanceOf(alice);
            vendorPrevFeeTokenBalance = await feeToken.balanceOf(vendor);
            tx = await mocFunctions.mintTC({ from: alice, qTC: 100, vendor });
          });
          it("THEN alice Fee Token balance decrease 12.5 (100 qAC + 2.5% qFeeToken + 10% qFeeTokenVendorMarkup)", async function () {
            const aliceActualVendorBalance = await feeToken.balanceOf(alice);
            const diff = alicePrevFeeTokenBalance.sub(aliceActualVendorBalance);
            assertPrec(12.5, diff);
          });
          it("THEN vendor Fee Token balance increase 10", async function () {
            const vendorActualVendorBalance = await feeToken.balanceOf(vendor);
            const diff = vendorActualVendorBalance.sub(vendorPrevFeeTokenBalance);
            assertPrec(10, diff);
          });
          it("THEN a TCMinted event is emitted", async function () {
            // sender: alice
            // receiver: alice
            // qTC: 100 TC
            // qAC: 100 AC
            // qACfee: 0
            // qFeeToken: 100 AC (5% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 10% qAC
            const args = [operator, alice, pEth(100), pEth(100), 0, pEth(100 * 0.05 * 0.5), 0, pEth(10), vendor];
            await expectTCMinted(tx, args);
          });
        });
        describe("WHEN alice redeems 100 TC via vendor", function () {
          let alicePrevFeeTokenBalance: Balance;
          let vendorPrevFeeTokenBalance: Balance;
          beforeEach(async function () {
            alicePrevFeeTokenBalance = await feeToken.balanceOf(alice);
            vendorPrevFeeTokenBalance = await feeToken.balanceOf(vendor);
            tx = await mocFunctions.redeemTC({ from: alice, qTC: 100, vendor });
          });
          it("THEN alice Fee Token balance decrease 12.5 (100 qAC + 2.5% qFeeToken + 10% qFeeTokenVendorMarkup)", async function () {
            const aliceActualVendorBalance = await feeToken.balanceOf(alice);
            const diff = alicePrevFeeTokenBalance.sub(aliceActualVendorBalance);
            assertPrec(12.5, diff);
          });
          it("THEN vendor Fee Token balance increase 10", async function () {
            const vendorActualVendorBalance = await feeToken.balanceOf(vendor);
            const diff = vendorActualVendorBalance.sub(vendorPrevFeeTokenBalance);
            assertPrec(10, diff);
          });
          it("THEN a TCRedeemed event is emitted", async function () {
            // sender: alice
            // receiver: alice
            // qTC: 100 TC
            // qAC: 100 AC
            // qACfee: 0
            // qFeeToken: 100 AC (5% * 50%)
            // qACVendorMarkup: 0
            // qFeeTokenVendorMarkup: 10% qAC
            const args = [operator, operator, pEth(100), pEth(100), 0, pEth(100 * 0.05 * 0.5), 0, pEth(10), vendor];
            await expectTCRedeemed(tx, args);
          });
        });
        describe("AND Fee Token price falls 10 times AC price", function () {
          // 1 Fee Token = 0.1 Assets
          beforeEach(async function () {
            await feeTokenPriceProvider.poke(pEth(0.1));
          });
          describe("WHEN alice mints 100 TC", function () {
            beforeEach(async function () {
              tx = await mocFunctions.mintTC({ from: alice, qTC: 100 });
            });
            it("THEN 25 Fee Token are spent instead of 2.5", async function () {
              // sender: alice
              // receiver: alice
              // qTC: 100 TC
              // qAC: 100 AC
              // qACfee: 0 AC
              // qFeeToken: 100 AC (5% * 50%) / 0.1
              // qACVendorMarkup: 0
              // qFeeTokenVendorMarkup: 0
              const args = [operator, alice, pEth(100), pEth(100), 0, pEth(1000 * 0.05 * 0.5), 0, 0, noVendor];
              await expectTCMinted(tx, args);
            });
          });
          describe("WHEN alice redeems 100 TC", function () {
            beforeEach(async function () {
              tx = await mocFunctions.redeemTC({ from: alice, qTC: 100 });
            });
            it("THEN 25 Fee Token are spent instead of 2.5", async function () {
              // sender: alice
              // receiver: alice
              // qTC: 100 TC
              // qAC: 100 AC
              // qACfee: 0 AC
              // qFeeToken: 100 AC (5% * 50%) / 0.1
              // qACVendorMarkup: 0
              // qFeeTokenVendorMarkup: 0
              const args = [operator, operator, pEth(100), pEth(100), 0, pEth(1000 * 0.05 * 0.5), 0, 0, noVendor];
              await expectTCRedeemed(tx, args);
            });
          });
        });
        describe("AND Fee Token price rises 10 times AC price", function () {
          // 1 Fee Token = 10 Assets
          beforeEach(async function () {
            await feeTokenPriceProvider.poke(pEth(10));
          });
          describe("WHEN alice mints 100 TC", function () {
            beforeEach(async function () {
              tx = await mocFunctions.mintTC({ from: alice, qTC: 100 });
            });
            it("THEN 0.25 Fee Token are spent instead of 2.5", async function () {
              // sender: alice
              // receiver: alice
              // qTC: 100 TC
              // qAC: 100 AC
              // qACfee: 0 AC
              // qFeeToken: 100 AC (5% * 50%) / 10
              // qACVendorMarkup: 0
              // qFeeTokenVendorMarkup: 0
              const args = [operator, alice, pEth(100), pEth(100), 0, pEth(10 * 0.05 * 0.5), 0, 0, noVendor];
              await expectTCMinted(tx, args);
            });
          });
          describe("WHEN alice redeems 100 TC", function () {
            beforeEach(async function () {
              tx = await mocFunctions.redeemTC({ from: alice, qTC: 100 });
            });
            it("THEN 0.25 Fee Token are spent instead of 2.5", async function () {
              // sender: alice
              // receiver: alice
              // qTC: 100 TC
              // qAC: 100 AC
              // qACfee: 0 AC
              // qFeeToken: 100 AC (5% * 50%) / 10
              // qACVendorMarkup: 0
              // qFeeTokenVendorMarkup: 0
              const args = [operator, operator, pEth(100), pEth(100), 0, pEth(10 * 0.05 * 0.5), 0, 0, noVendor];
              await expectTCRedeemed(tx, args);
            });
          });
        });
      });
    });
  });
};

export { feeTokenBehavior };
