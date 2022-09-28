import { fixtureDeployedMocCABag } from "./fixture";
import { ERC20Mock, MocCAWrapper, PriceProviderMock } from "../../typechain";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { redeemTCBehavior } from "../behaviors/redeemTC.behavior";
import { Balance, deployAsset, deployPriceProvider, ERRORS, pEth } from "../helpers/utils";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { assertPrec } from "../helpers/assertHelper";
import { ContractTransaction } from "ethers";
import { tpParams } from "../helpers/utils";

describe("Feature: MocCABag redeem TC", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      ({ deployer, alice, bob } = await getNamedAccounts());
      this.mocContracts = await fixtureDeployedMocCABag(tpParams.length, tpParams)();
      mocFunctions = await mocFunctionsCARBag(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({ assetDefault, mocWrapper } = this.mocContracts);
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
  });

  describe("WHEN alice redeems 10 TC", () => {
    let tx: ContractTransaction;
    beforeEach(async () => {
      //add collateral
      await mocFunctions.mintTC({ from: alice, qTC: 1000 });
      tx = await mocFunctions.redeemTC({ from: alice, qTC: 10 });
    });
    it("THEN a TCRedeemed event is emitted by MocWrapper", async function () {
      // asset: assetDefault
      // sender: alice
      // receiver: alice
      // qTC: 10 TC
      // qAC: 10AC - 5% for Moc Fee Flow
      await expect(tx)
        .to.emit(mocWrapper, "TCRedeemed")
        .withArgs(assetDefault.address, alice, alice, pEth(10), pEth(10 * 0.95));
    });
  });

  describe("WHEN alice redeems 10 TC to bob", () => {
    let tx: ContractTransaction;
    beforeEach(async () => {
      //add collateral
      await mocFunctions.mintTC({ from: alice, qTC: 1000 });
      tx = await mocFunctions.redeemTCto({ from: alice, to: bob, qTC: 10 });
    });
    it("THEN a TCRedeemed event is emitted by MocWrapper", async function () {
      // asset: assetDefault
      // sender: alice
      // receiver: bob
      // qTC: 10 TC
      // qAC: 10AC - 5% for Moc Fee Flow
      await expect(tx)
        .to.emit(mocWrapper, "TCRedeemed")
        .withArgs(assetDefault.address, alice, bob, pEth(10), pEth(10 * 0.95));
    });
  });

  describe("GIVEN 100 TC minted with asset at 1:1 price", () => {
    let newAsset: ERC20Mock;
    let newPriceProvider: PriceProviderMock;
    beforeEach(async () => {
      await mocFunctions.mintTC({ from: alice, qTC: 100 });
    });
    describe("WHEN add a new asset with price 0.9", () => {
      beforeEach(async () => {
        newAsset = await deployAsset();
        newPriceProvider = await deployPriceProvider(pEth(0.9));
        await mocFunctions.addAsset(newAsset, newPriceProvider);
        // add stock of the new asset to the collateral bag
        await mocFunctions.mintTC({ from: deployer, qTC: 1000, asset: newAsset });
      });
      describe("AND redeem 100 TC in exchange of the new asset", () => {
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
    describe("WHEN add a new asset with price 1.1", () => {
      beforeEach(async () => {
        newAsset = await deployAsset();
        newPriceProvider = await deployPriceProvider(pEth(1.1));
        await mocFunctions.addAsset(newAsset, newPriceProvider);
        // add stock of the new asset to the collateral bag
        await mocFunctions.mintTC({ from: deployer, qTC: 1000, asset: newAsset });
      });
      describe("AND redeem 100 TC in exchange of the new asset", () => {
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
