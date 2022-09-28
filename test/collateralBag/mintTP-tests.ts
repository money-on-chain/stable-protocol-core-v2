import { fixtureDeployedMocCABag } from "./fixture";
import { ERC20Mock, MocCAWrapper, PriceProviderMock } from "../../typechain";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { mintTPBehavior } from "../behaviors/mintTP.behavior";
import { Balance, deployAsset, deployPriceProvider, ERRORS, pEth } from "../helpers/utils";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { assertPrec } from "../helpers/assertHelper";
import { ContractTransaction } from "ethers";
import { tpParams } from "../helpers/utils";

describe("Feature: MocCABag mint TP", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      ({ deployer, alice, bob } = await getNamedAccounts());
      this.mocContracts = await fixtureDeployedMocCABag(tpParams.length, tpParams)();
      mocFunctions = await mocFunctionsCARBag(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({ assetDefault, mocWrapper } = this.mocContracts);
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

    describe("WHEN alice mints 2350 TP", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        //add collateral
        await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
        tx = await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 2350 });
      });
      it("THEN a TPMinted event is emitted by MocWrapper", async function () {
        // asset: assetDefault
        // i: 0
        // sender: alice
        // receiver: alice
        // qTP: 2350 TP
        // qAC: 10AC + 5% for Moc Fee Flow
        await expect(tx)
          .to.emit(mocWrapper, "TPMinted")
          .withArgs(assetDefault.address, TP_0, alice, alice, pEth(2350), pEth(10 * 1.05));
      });
    });

    describe("WHEN alice mints 2350 TP to bob", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        //add collateral
        await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
        tx = await mocFunctions.mintTPto({ i: TP_0, from: alice, to: bob, qTP: 2350 });
      });
      it("THEN a TPMinted event is emitted by MocWrapper", async function () {
        // asset: assetDefault
        // i: 0
        // sender: alice
        // receiver: bob
        // qTP: 2350 TP
        // qAC: 10AC + 5% for Moc Fee Flow
        await expect(tx)
          .to.emit(mocWrapper, "TPMinted")
          .withArgs(assetDefault.address, TP_0, alice, bob, pEth(2350), pEth(10 * 1.05));
      });
    });

    describe("GIVEN 23500 TP minted with asset at 1:1 price", () => {
      let newAsset: ERC20Mock;
      let newPriceProvider: PriceProviderMock;
      beforeEach(async () => {
        //add collateral
        await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
        await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500 });
      });
      describe("WHEN add a new asset with price 0.9", () => {
        beforeEach(async () => {
          newAsset = await deployAsset();
          newPriceProvider = await deployPriceProvider(pEth(0.9));
          await mocFunctions.addAsset(newAsset, newPriceProvider);
        });
        describe("AND mint 23500 TP with new asset", () => {
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
      describe("WHEN add a new asset with price 1.1", () => {
        beforeEach(async () => {
          newAsset = await deployAsset();
          newPriceProvider = await deployPriceProvider(pEth(1.1));
          await mocFunctions.addAsset(newAsset, newPriceProvider);
        });
        describe("AND mint 23500 TP with new asset", () => {
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
