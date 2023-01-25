import hre, { getNamedAccounts, ethers } from "hardhat";
import { ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { assertPrec } from "../helpers/assertHelper";
import { Balance, pEth } from "../helpers/utils";
import { getNetworkDeployParams } from "../../scripts/utils";
import { ERC20Mock, ERC20Mock__factory, PriceProviderMock, PriceProviderMock__factory } from "../../typechain";

const feeTokenBehavior = function () {
  let feeToken: ERC20Mock;
  let feeTokenPriceProvider: PriceProviderMock;
  let mocContracts: any;
  let mocFunctions: any;
  let alice: Address;
  const { mocFeeFlowAddress } = getNetworkDeployParams(hre).mocAddresses;
  let tx: ContractTransaction;

  describe("Feature: Fee Token as fee payment method", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ alice } = await getNamedAccounts());
      feeToken = ERC20Mock__factory.connect(await mocContracts.mocImpl.feeToken(), ethers.provider.getSigner());
      feeTokenPriceProvider = PriceProviderMock__factory.connect(
        await mocContracts.mocImpl.feeTokenPriceProvider(),
        ethers.provider.getSigner(),
      );
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
          await feeToken.connect(await ethers.getSigner(alice)).approve(spender, pEth(25));
        });
        describe("WHEN alice mints 10000 TC and doesn´t have enough Fee Token allowance", function () {
          beforeEach(async function () {
            await feeToken.mint(alice, pEth(10000));
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
            await feeToken.connect(await ethers.getSigner(alice)).approve(spender, pEth(10000));
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
          let alicePrevACBalance: Balance;
          let alicePrevFeeTokenBalance: Balance;
          let mocFeeFlowPrevACBalance: Balance;
          let mocFeeFlowPrevFeeTokenBalance: Balance;
          beforeEach(async function () {
            alicePrevACBalance = await mocFunctions.assetBalanceOf(alice);
            alicePrevFeeTokenBalance = await feeToken.balanceOf(alice);
            mocFeeFlowPrevACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
            mocFeeFlowPrevFeeTokenBalance = await feeToken.balanceOf(mocFeeFlowAddress);
            tx = await mocFunctions.mintTC({ from: alice, qTC: 100 });
          });
          it("THEN alice AC balance decrease 100 Asset", async function () {
            const aliceActualACBalance = await mocFunctions.assetBalanceOf(alice);
            const diff = alicePrevACBalance.sub(aliceActualACBalance);
            assertPrec(100, diff);
          });
          it("THEN alice Fee Token balance decrease 2.5", async function () {
            const aliceActualFeeTokenBalance = await feeToken.balanceOf(alice);
            const diff = alicePrevFeeTokenBalance.sub(aliceActualFeeTokenBalance);
            assertPrec(2.5, diff);
          });
          it("THEN Moc Fee Flow AC balance doesn´t change", async function () {
            const mocFeeFlowActualACBalance = await mocFunctions.acBalanceOf(mocFeeFlowAddress);
            assertPrec(mocFeeFlowActualACBalance, mocFeeFlowPrevACBalance);
          });
          it("THEN Moc Fee Flow Fee Token balance increase 2.5", async function () {
            const mocFeeFlowActualFeeTokenBalance = await feeToken.balanceOf(mocFeeFlowAddress);
            const diff = mocFeeFlowActualFeeTokenBalance.sub(mocFeeFlowPrevFeeTokenBalance);
            assertPrec(2.5, diff);
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
