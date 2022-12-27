import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { ERC20Mock, MocCAWrapper, PriceProviderMock } from "../../typechain";
import { mocFunctionsCABag } from "../helpers/mocFunctionsCABag";
import { mintTPBehavior } from "../behaviors/mintTP.behavior";
import { Balance, ERRORS, deployAsset, deployPriceProvider, pEth, tpParams } from "../helpers/utils";
import { assertPrec } from "../helpers/assertHelper";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag mint TP", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let assetPriceProvider: PriceProviderMock;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
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
    });
    mintTPBehavior();

    describe("WHEN mint TP using an asset not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because asset is invalid", async () => {
        await expect(mocWrapper.mintTP(assetNotWhitelisted.address, 0, 10, 10)).to.be.revertedWithCustomError(
          mocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });

    describe("AND there are 23500 TP minted with asset price at 1:1", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        //add collateral
        await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
        await mocFunctions.mintTP({ i: TP_0, from: deployer, qTP: 23500 });
      });
      describe("WHEN alice mints 2350 TP", () => {
        beforeEach(async () => {
          tx = await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 2350 });
        });
        it("THEN Pegged Tokens AC price is 235", async function () {
          assertPrec(235, await this.mocContracts.mocImpl.getPACtp(TP_0));
        });
        it("THEN a TPMintedWithWrapper event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // i: 0
          // sender: alice
          // receiver: alice
          // qTP: 2350 TP
          // qAC: 10AC + 5% for Moc Fee Flow
          await expect(tx)
            .to.emit(mocWrapper, "TPMintedWithWrapper")
            .withArgs(assetDefault.address, TP_0, alice, alice, pEth(2350), pEth(10 * 1.05));
        });
      });
      describe("WHEN alice mints 2350 TP to bob", () => {
        beforeEach(async () => {
          tx = await mocFunctions.mintTPto({ i: TP_0, from: alice, to: bob, qTP: 2350 });
        });
        it("THEN a TPMintedWithWrapper event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // i: 0
          // sender: alice
          // receiver: bob
          // qTP: 2350 TP
          // qAC: 10AC + 5% for Moc Fee Flow
          await expect(tx)
            .to.emit(mocWrapper, "TPMintedWithWrapper")
            .withArgs(assetDefault.address, TP_0, alice, bob, pEth(2350), pEth(10 * 1.05));
        });
      });
      describe("AND asset price provider is deprecated", () => {
        beforeEach(async () => {
          await assetPriceProvider.deprecatePriceProvider();
        });
        describe("WHEN alice tries to mint 2350 TP", () => {
          it("THEN tx fails because invalid price provider", async () => {
            await expect(mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 2350 })).to.be.revertedWithCustomError(
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
        });
        describe("WHEN mint 23500 TP with new asset", () => {
          let aliceNewAssetPrevBalance: Balance;
          beforeEach(async () => {
            aliceNewAssetPrevBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500, asset: newAsset });
          });
          it("THEN alice spent 116.66 new asset instead of 105", async () => {
            //asset spent = 105 currency needed / 0.9 asset used price
            const aliceNewAssetActualBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            const diff = aliceNewAssetPrevBalance.sub(aliceNewAssetActualBalance);
            assertPrec("116.666666666666666667", diff);
          });
        });
      });
      describe("AND a new asset with price 1.1 is added", () => {
        beforeEach(async () => {
          newAsset = await deployAsset();
          newPriceProvider = await deployPriceProvider(pEth(1.1));
          await mocFunctions.addOrEditAsset(newAsset, newPriceProvider, 18);
        });
        describe("WHEN mint 23500 TP with new asset", () => {
          let aliceNewAssetPrevBalance: Balance;
          beforeEach(async () => {
            aliceNewAssetPrevBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500, asset: newAsset });
          });
          it("THEN alice spent 95.45 new asset instead of 105", async () => {
            //asset spent = 105 currency needed / 1.1 asset used price
            const aliceNewAssetActualBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            const diff = aliceNewAssetPrevBalance.sub(aliceNewAssetActualBalance);
            assertPrec("95.454545454545454546", diff);
          });
        });
      });
    });
  });
});
