import { getNamedAccounts, ethers } from "hardhat";
import { ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { PriceProviderMock, PriceProviderMock__factory } from "../../typechain";
import { pEth } from "../helpers/utils";

const feeTokenBehavior = function () {
  let feeTokenPriceProvider: PriceProviderMock;
  let mocContracts: any;
  let mocFunctions: any;
  let alice: Address;
  let tx: ContractTransaction;

  describe("Feature: Fee Token as fee payment method", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ alice } = await getNamedAccounts());
      feeTokenPriceProvider = PriceProviderMock__factory.connect(
        await mocContracts.mocImpl.feeTokenPriceProvider(),
        ethers.provider.getSigner(),
      );
    });
    describe("GIVEN alice has 50 Fee Token", function () {
      beforeEach(async function () {
        await mocContracts.feeToken.mint(alice, pEth(50));
      });
      describe("WHEN alice mints 100 TC without sending Fee Token approval", function () {
        beforeEach(async function () {
          tx = await mocFunctions.mintTC({ from: alice, qTC: 100 });
        });
        it("THEN a AC is used as fee payment method", async function () {
          // sender: alice || mocWrapper
          // receiver: alice
          // qTC: 100 TC
          // qAC: 100 AC + 5% for Moc Fee Flow
          // qACfee: %5 AC
          // qFeeToken: 0
          await expect(tx)
            .to.emit(mocContracts.mocImpl, "TCMinted")
            .withArgs(
              mocContracts.mocWrapper?.address || alice,
              alice,
              pEth(100),
              pEth(100 * 1.05),
              pEth(100 * 0.05),
              0,
            );
        });
      });
      describe("AND alice approves 25 Fee Token to Moc Core", function () {
        beforeEach(async function () {
          // for collateral bag implementation approve must be set to Moc Wrapper contract
          const spender = mocContracts.mocWrapper?.address || mocContracts.mocImpl.address;
          await mocContracts.feeToken.connect(await ethers.getSigner(alice)).approve(spender, pEth(25));
        });
        describe("WHEN alice mints 10000 TC and doesn´t have enough Fee Token allowance", function () {
          beforeEach(async function () {
            await mocContracts.feeToken.mint(alice, pEth(10000));
            tx = await mocFunctions.mintTC({ from: alice, qTC: 10000 });
          });
          it("THEN a AC is used as fee payment method", async function () {
            // sender: alice || mocWrapper
            // receiver: alice
            // qTC: 10000 TC
            // qAC: 10000 AC + 5% for Moc Fee Flow
            // qACfee: %5 AC
            // qFeeToken: 0
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TCMinted")
              .withArgs(
                mocContracts.mocWrapper?.address || alice,
                alice,
                pEth(10000),
                pEth(10000 * 1.05),
                pEth(10000 * 0.05),
                0,
              );
          });
        });
        describe("WHEN alice mints 10000 TC and doesn´t have enough Fee Token balance", function () {
          beforeEach(async function () {
            // for collateral bag implementation approve must be set to Moc Wrapper contract
            const spender = mocContracts.mocWrapper?.address || mocContracts.mocImpl.address;
            await mocContracts.feeToken.connect(await ethers.getSigner(alice)).approve(spender, pEth(10000));
            tx = await mocFunctions.mintTC({ from: alice, qTC: 10000 });
          });
          it("THEN a AC is used as fee payment method", async function () {
            // sender: alice || mocWrapper
            // receiver: alice
            // qTC: 10000 TC
            // qAC: 10000 AC + 5% for Moc Fee Flow
            // qACfee: %5 AC
            // qFeeToken: 0
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TCMinted")
              .withArgs(
                mocContracts.mocWrapper?.address || alice,
                alice,
                pEth(10000),
                pEth(10000 * 1.05),
                pEth(10000 * 0.05),
                0,
              );
          });
        });
        describe("AND Fee Token price provider doesn´t have a valid price", function () {
          beforeEach(async function () {
            await feeTokenPriceProvider.deprecatePriceProvider();
          });
          describe("WHEN alice mints 100 TC", function () {
            beforeEach(async function () {
              tx = await mocFunctions.mintTC({ from: alice, qTC: 100 });
            });
            it("THEN a AC is used as fee payment method", async function () {
              // sender: alice || mocWrapper
              // receiver: alice
              // qTC: 100 TC
              // qAC: 100 AC + 5% for Moc Fee Flow
              // qACfee: %5 AC
              // qFeeToken: 0
              await expect(tx)
                .to.emit(mocContracts.mocImpl, "TCMinted")
                .withArgs(
                  mocContracts.mocWrapper?.address || alice,
                  alice,
                  pEth(100),
                  pEth(100 * 1.05),
                  pEth(100 * 0.05),
                  0,
                );
            });
          });
        });
        describe("WHEN alice mints 100 TC", function () {
          beforeEach(async function () {
            tx = await mocFunctions.mintTC({ from: alice, qTC: 100 });
          });
          it("THEN Fee Token is used as fee payment method", async function () {
            // sender: alice || mocWrapper
            // receiver: alice
            // qTC: 100 TC
            // qAC: 100 AC
            // qACfee: 0 AC
            // qFeeToken: 100 AC (5% * 50%)
            await expect(tx)
              .to.emit(mocContracts.mocImpl, "TCMinted")
              .withArgs(
                mocContracts.mocWrapper?.address || alice,
                alice,
                pEth(100),
                pEth(100),
                0,
                pEth(100 * 0.05 * 0.5),
              );
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
              // sender: alice || mocWrapper
              // receiver: alice
              // qTC: 100 TC
              // qAC: 100 AC
              // qACfee: 0 AC
              // qFeeToken: 100 AC (5% * 50%) / 0.1
              await expect(tx)
                .to.emit(mocContracts.mocImpl, "TCMinted")
                .withArgs(
                  mocContracts.mocWrapper?.address || alice,
                  alice,
                  pEth(100),
                  pEth(100),
                  0,
                  pEth(1000 * 0.05 * 0.5),
                );
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
              // sender: alice || mocWrapper
              // receiver: alice
              // qTC: 100 TC
              // qAC: 100 AC
              // qACfee: 0 AC
              // qFeeToken: 100 AC (5% * 50%) / 10
              await expect(tx)
                .to.emit(mocContracts.mocImpl, "TCMinted")
                .withArgs(
                  mocContracts.mocWrapper?.address || alice,
                  alice,
                  pEth(100),
                  pEth(100),
                  0,
                  pEth(10 * 0.05 * 0.5),
                );
            });
          });
        });
      });
    });
  });
};

export { feeTokenBehavior };
