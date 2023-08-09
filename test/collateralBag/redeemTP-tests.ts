import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { ERC20Mock, MocCAWrapper, PriceProviderMock } from "../../typechain";
import { mocFunctionsCABag } from "../helpers/mocFunctionsCABag";
import { redeemTPBehavior } from "../behaviors/redeemTP.behavior";
import { Balance, ERRORS, deployAsset, deployPriceProvider, pEth, tpParams } from "../helpers/utils";
import { assertPrec } from "../helpers/assertHelper";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag redeem TP", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let assetPriceProvider: PriceProviderMock;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  let tp0: Address;
  const TP_0 = 0;

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
      tp0 = this.mocContracts.mocPeggedTokens[TP_0].address;
    });
    redeemTPBehavior();

    describe("WHEN redeem TP using an asset not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because asset is invalid", async () => {
        await expect(mocWrapper.redeemTP(assetNotWhitelisted.address, tp0, 10, 10)).to.be.revertedWithCustomError(
          mocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });

    describe("AND alice has 23500 TPs with asset price at 1:1", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        // add collateral
        await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
        // mint TP to alice
        await mocFunctions.mintTP({ from: alice, qTP: 23500 });
      });
      describe("WHEN alice redeems 2350 TP", () => {
        beforeEach(async () => {
          tx = await mocFunctions.redeemTP({ from: alice, qTP: 2350 });
        });
        it("THEN a TPRedeemedWithWrapper event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // i: 0
          // sender: alice
          // receiver: alice
          // qTP: 2350 TP
          // qAC: 10AC - 5% for Moc Fee Flow
          await expect(tx)
            .to.emit(mocWrapper, "TPRedeemedWithWrapper")
            .withArgs(assetDefault.address, tp0, alice, alice, pEth(2350), pEth(9.5));
        });
      });
      describe("WHEN alice redeems 2350 TP to bob", () => {
        beforeEach(async () => {
          tx = await mocFunctions.redeemTPto({ from: alice, to: bob, qTP: 2350 });
        });
        it("THEN a TPRedeemedWithWrapper event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // i: 0
          // sender: alice
          // receiver: bob
          // qTP: 2350 TP
          // qAC: 10AC - 5% for Moc Fee Flow
          await expect(tx)
            .to.emit(mocWrapper, "TPRedeemedWithWrapper")
            .withArgs(assetDefault.address, tp0, alice, bob, pEth(2350), pEth(9.5));
        });
      });
      describe("AND asset price provider is deprecated", () => {
        beforeEach(async () => {
          await assetPriceProvider.deprecatePriceProvider();
        });
        describe("WHEN alice tries to redeem 2350 TP", () => {
          it("THEN tx fails because invalid price provider", async () => {
            await expect(mocFunctions.redeemTP({ from: alice, qTP: 2350 })).to.be.revertedWithCustomError(
              mocWrapper,
              ERRORS.MISSING_PROVIDER_PRICE,
            );
          });
        });
      });
      let newAsset: ERC20Mock;
      let newPriceProvider: PriceProviderMock;
      describe("AND a new asset with price 0.9 is added", () => {
        beforeEach(async () => {
          newAsset = await deployAsset();
          newPriceProvider = await deployPriceProvider(pEth(0.9));
          await mocFunctions.addOrEditAsset(newAsset, newPriceProvider, 18);
          // add stock of the new asset to the collateral bag
          await mocFunctions.mintTC({ from: deployer, qTC: 1000, asset: newAsset });
        });
        describe("WHEN redeem 23500 TP in exchange of the new asset", () => {
          let aliceNewAssetPrevBalance: Balance;
          beforeEach(async () => {
            aliceNewAssetPrevBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            await mocFunctions.redeemTP({ from: alice, qTP: 23500, asset: newAsset });
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
        describe("WHEN redeem 23500 TP with new asset", () => {
          let aliceNewAssetPrevBalance: Balance;
          beforeEach(async () => {
            aliceNewAssetPrevBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            await mocFunctions.redeemTP({ from: alice, qTP: 23500, asset: newAsset });
          });
          it("THEN alice receives 86.36 of the new asset instead of 95", async () => {
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
