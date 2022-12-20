import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { ERC20Mock, MocCAWrapper, PriceProviderMock } from "../../typechain";
import { mocFunctionsCABag } from "../helpers/mocFunctionsCABag";
import { redeemTCBehavior } from "../behaviors/redeemTC.behavior";
import { Balance, ERRORS, deployAsset, deployPriceProvider, pEth, tpParams } from "../helpers/utils";
import { assertPrec } from "../helpers/assertHelper";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag redeem TC", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let assetPriceProvider: PriceProviderMock;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      ({ deployer, alice, bob } = await getNamedAccounts());
      this.mocContracts = await fixtureDeployedMocCABag(tpParams.length, tpParams)();
      mocFunctions = await mocFunctionsCABag(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({
        assets: [assetDefault],
        mocWrapper,
        assetPriceProviders: [assetPriceProvider],
      } = this.mocContracts);
    });
    redeemTCBehavior();

    describe("WHEN redeem TC using an asset not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because asset is invalid", async () => {
        await expect(mocWrapper.redeemTC(assetNotWhitelisted.address, 10, 10)).to.be.revertedWithCustomError(
          mocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("AND alice has 1000 TC with asset price at 1:1", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        await mocFunctions.mintTC({ from: alice, qTC: 1000 });
      });
      describe("WHEN alice redeems 10 TC", () => {
        beforeEach(async () => {
          tx = await mocFunctions.redeemTC({ from: alice, qTC: 10 });
        });
        it("THEN a TCRedeemedWithWrapper event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // sender: alice
          // receiver: alice
          // qTC: 10 TC
          // qAC: 10AC - 5% for Moc Fee Flow
          await expect(tx)
            .to.emit(mocWrapper, "TCRedeemedWithWrapper")
            .withArgs(assetDefault.address, alice, alice, pEth(10), pEth(10 * 0.95));
        });
      });
      describe("WHEN alice redeems 10 TC to bob", () => {
        beforeEach(async () => {
          tx = await mocFunctions.redeemTCto({ from: alice, to: bob, qTC: 10 });
        });
        it("THEN a TCRedeemedWithWrapper event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // sender: alice
          // receiver: bob
          // qTC: 10 TC
          // qAC: 10AC - 5% for Moc Fee Flow
          await expect(tx)
            .to.emit(mocWrapper, "TCRedeemedWithWrapper")
            .withArgs(assetDefault.address, alice, bob, pEth(10), pEth(10 * 0.95));
        });
      });
      describe("AND asset price provider is deprecated", () => {
        beforeEach(async () => {
          await assetPriceProvider.deprecatePriceProvider();
        });
        describe("WHEN alice tries to redeem 10 TC", () => {
          it("THEN tx fails because invalid price provider", async () => {
            await expect(mocFunctions.redeemTC({ from: alice, qTC: 10 })).to.be.revertedWithCustomError(
              mocWrapper,
              ERRORS.INVALID_PRICE_PROVIDER,
            );
          });
        });
      });
      let newAsset: ERC20Mock;
      let newPriceProvider: PriceProviderMock;
      describe("AND new asset with price 0.9 is added", () => {
        beforeEach(async () => {
          newAsset = await deployAsset();
          newPriceProvider = await deployPriceProvider(pEth(0.9));
          await mocFunctions.addOrEditAsset(newAsset, newPriceProvider, 18);
          // add stock of the new asset to the collateral bag
          await mocFunctions.mintTC({ from: deployer, qTC: 1000, asset: newAsset });
        });
        describe("WHEN redeem 100 TC in exchange of the new asset", () => {
          let aliceNewAssetPrevBalance: Balance;
          beforeEach(async () => {
            aliceNewAssetPrevBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            await mocFunctions.redeemTC({ from: alice, qTC: 100, asset: newAsset });
          });
          it("THEN alice receives 105.55 of the new asset instead of 95", async () => {
            //asset reward = 95 currency / 0.9 asset price
            const aliceNewAssetActualBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            const diff = aliceNewAssetActualBalance.sub(aliceNewAssetPrevBalance);
            assertPrec("105.555555555555555555", diff);
          });
        });
      });
      describe("AND a new asset with price 1.1 is added", () => {
        beforeEach(async () => {
          newAsset = await deployAsset();
          newPriceProvider = await deployPriceProvider(pEth(1.1));
          await mocFunctions.addOrEditAsset(newAsset, newPriceProvider, 18);
          // add stock of the new asset to the collateral bag
          await mocFunctions.mintTC({ from: deployer, qTC: 1000, asset: newAsset });
        });
        describe("WHEN redeem 100 TC in exchange of the new asset", () => {
          let aliceNewAssetPrevBalance: Balance;
          beforeEach(async () => {
            aliceNewAssetPrevBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            await mocFunctions.redeemTC({ from: alice, qTC: 100, asset: newAsset });
          });
          it("THEN alice receives 86.36 new asset instead of 95", async () => {
            //asset reward = 95 currency / 1.1 asset price
            const aliceNewAssetActualBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            const diff = aliceNewAssetActualBalance.sub(aliceNewAssetPrevBalance);
            assertPrec("86.363636363636363636", diff);
          });
        });
      });
    });
  });
});
