import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { ERC20Mock, MocCAWrapper, PriceProviderMock } from "../../typechain";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { mintTCBehavior } from "../behaviors/mintTC.behavior";
import { Balance, CONSTANTS, ERRORS, deployAsset, deployPriceProvider, pEth, tpParams } from "../helpers/utils";
import { assertPrec } from "../helpers/assertHelper";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag mint TC", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let assetPriceProvider: PriceProviderMock;
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      ({ alice, bob } = await getNamedAccounts());
      this.mocContracts = await fixtureDeployedMocCABag(tpParams.length, tpParams)();
      mocFunctions = await mocFunctionsCARBag(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({
        assets: [assetDefault],
        mocWrapper,
        assetPriceProviders: [assetPriceProvider],
      } = this.mocContracts);
    });
    mintTCBehavior();

    describe("WHEN a user sends almost max uint256 amount of Asset to mint TC", function () {
      it("THEN tx reverts with panic code 0x11 overflow", async function () {
        const qACmax = CONSTANTS.MAX_BALANCE.mul(10);
        await assetDefault.approve(mocWrapper.address, qACmax);
        await expect(mocWrapper.mintTC(assetDefault.address, CONSTANTS.MAX_BALANCE, qACmax)).to.be.revertedWithPanic(
          "0x11",
        );
      });
    });

    describe("WHEN mint TC using an assetDefault not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because assetDefault is invalid", async () => {
        await expect(mocWrapper.mintTC(assetNotWhitelisted.address, 10, 10)).to.be.revertedWithCustomError(
          mocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });

    describe("AND asset price provider is deprecated", () => {
      beforeEach(async () => {
        await assetPriceProvider.deprecatePriceProvider();
      });
      describe("WHEN alice tries to mint 10 TC", () => {
        it("THEN tx fails because invalid price provider", async () => {
          await expect(mocFunctions.mintTC({ from: alice, qTC: 10 })).to.be.revertedWithCustomError(
            mocWrapper,
            ERRORS.INVALID_PRICE_PROVIDER,
          );
        });
      });
    });

    describe("WHEN alice mints 10 TC", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        tx = await mocFunctions.mintTC({ from: alice, qTC: 10 });
      });
      it("THEN Collateral Asset held in the Collateral Bag are 10", async function () {
        assertPrec(10, await this.mocContracts.mocImpl.nACcb());
      });
      it("THEN Collateral Tokens held in the Collateral Bag are 10", async function () {
        assertPrec(10, await this.mocContracts.mocImpl.nTCcb());
      });
      it("THEN a TCMinted event is emitted by MocWrapper", async function () {
        // asset: assetDefault
        // sender: alice
        // receiver: alice
        // qTC: 10 TC
        // qAC: 10AC + 5% for Moc Fee Flow
        await expect(tx)
          .to.emit(mocWrapper, "TCMinted")
          .withArgs(assetDefault.address, alice, alice, pEth(10), pEth(10 * 1.05));
      });
    });

    describe("WHEN alice mints 10 TC to bob", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        tx = await mocFunctions.mintTCto({ from: alice, to: bob, qTC: 10 });
      });
      it("THEN a TCMinted event is emitted by MocWrapper", async function () {
        // asset: assetDefault
        // sender: alice
        // receiver: bob
        // qTC: 10 TC
        // qAC: 10AC + 5% for Moc Fee Flow
        await expect(tx)
          .to.emit(mocWrapper, "TCMinted")
          .withArgs(assetDefault.address, alice, bob, pEth(10), pEth(10 * 1.05));
      });
    });

    describe("GIVEN 100 TC minted with assetDefault at 1:1 price", () => {
      let newAsset: ERC20Mock;
      let newPriceProvider: PriceProviderMock;
      beforeEach(async () => {
        await mocFunctions.mintTC({ from: alice, qTC: 100 });
      });
      describe("AND add a new assetDefault with price 0.9", () => {
        beforeEach(async () => {
          newAsset = await deployAsset();
          newPriceProvider = await deployPriceProvider(pEth(0.9));
          await mocFunctions.addOrEditAsset(newAsset, newPriceProvider);
        });
        describe("WHEN mint 100 TC with new asset", () => {
          let aliceNewAssetPrevBalance: Balance;
          beforeEach(async () => {
            aliceNewAssetPrevBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            await mocFunctions.mintTC({ from: alice, qTC: 100, asset: newAsset });
          });
          it("THEN alice spent 116.66 new assetDefault instead of 105", async () => {
            //assetDefault spent = 105 currency needed / 0.9 assetDefault used price
            const aliceNewAssetActualBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            const diff = aliceNewAssetPrevBalance.sub(aliceNewAssetActualBalance);
            assertPrec("116.666666666666666667", diff);
          });
        });
      });
      describe("AND add a new assetDefault with price 1.1", () => {
        beforeEach(async () => {
          newAsset = await deployAsset();
          newPriceProvider = await deployPriceProvider(pEth(1.1));
          await mocFunctions.addOrEditAsset(newAsset, newPriceProvider);
        });
        describe("WHEN mint 100 TC with new asset", () => {
          let aliceNewAssetPrevBalance: Balance;
          beforeEach(async () => {
            aliceNewAssetPrevBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            await mocFunctions.mintTC({ from: alice, qTC: 100, asset: newAsset });
          });
          it("THEN alice spent 95.45 new assetDefault instead of 105", async () => {
            //assetDefault spent = 105 currency needed / 1.1 assetDefault used price
            const aliceNewAssetActualBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            const diff = aliceNewAssetPrevBalance.sub(aliceNewAssetActualBalance);
            assertPrec("95.454545454545454546", diff);
          });
        });
      });
    });
  });
});
