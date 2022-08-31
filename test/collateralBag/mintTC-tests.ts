import { fixtureDeployedMocCABag } from "./fixture";
import { ERC20Mock, MocCARC20, MocCAWrapper, MocRC20, PriceProviderMock } from "../../typechain";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { mintTCBehavior } from "../behaviors/mintTC.behavior";
import { Balance, deployAsset, deployPriceProvider, ERRORS, pEth, CONSTANTS } from "../helpers/utils";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { assertPrec } from "../helpers/assertHelper";

describe("Feature: MocCABag mint TC", function () {
  let mocImpl: MocCARC20;
  let mocWrapper: MocCAWrapper;
  let wcaToken: MocRC20;
  let mocCollateralToken: MocRC20;
  let asset: ERC20Mock;
  let mocFunctions: any;
  let alice: Address;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      ({ alice } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCABag(0);
      ({ mocImpl, mocWrapper, mocCollateralToken, wcaToken, asset } = await fixtureDeploy());
      mocFunctions = await mocFunctionsCARBag({ mocImpl, mocCollateralToken, mocWrapper, wcaToken }, asset);
      this.mocFunctions = mocFunctions;
      this.mocContracts = { mocImpl, mocWrapper, mocCollateralToken };
    });
    mintTCBehavior();

    describe("WHEN a user sends almost max uint256 amount of Asset to mint TC", function () {
      it("THEN tx reverts with panic code 0x11 overflow", async function () {
        const qACmax = CONSTANTS.MAX_BALANCE.mul(10);
        await asset.approve(mocWrapper.address, qACmax);
        await expect(mocWrapper.mintTC(asset.address, CONSTANTS.MAX_BALANCE, qACmax)).to.be.revertedWithPanic("0x11");
      });
    });

    describe("WHEN mint TC using an asset not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because asset is invalid", async () => {
        await expect(mocWrapper.mintTC(assetNotWhitelisted.address, 10, 10)).to.be.revertedWithCustomError(
          mocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
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
          newPriceProvider = await deployPriceProvider(pEth("0.9"));
          await mocFunctions.addAsset(newAsset, newPriceProvider);
        });
        describe("AND mint 100 TC with new asset", () => {
          let aliceNewAssetPrevBalance: Balance;
          beforeEach(async () => {
            aliceNewAssetPrevBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            await mocFunctions.mintTC({ from: alice, qTC: 100, asset: newAsset });
          });
          it("THEN alice spent 116.66 new asset instead of 105", async () => {
            //asset spent = 105 currency needed / 0.9 asset used price
            const aliceNewAssetActualBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            const diff = aliceNewAssetPrevBalance.sub(aliceNewAssetActualBalance);
            assertPrec("116.666666666666666666", diff);
          });
        });
      });
      describe("WHEN add a new asset with price 1.1", () => {
        beforeEach(async () => {
          newAsset = await deployAsset();
          newPriceProvider = await deployPriceProvider(pEth("1.1"));
          await mocFunctions.addAsset(newAsset, newPriceProvider);
        });
        describe("AND mint 100 TC with new asset", () => {
          let aliceNewAssetPrevBalance: Balance;
          beforeEach(async () => {
            aliceNewAssetPrevBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            await mocFunctions.mintTC({ from: alice, qTC: 100, asset: newAsset });
          });
          it("THEN alice spent 95.45 new asset instead of 105", async () => {
            //asset spent = 105 currency needed / 1.1 asset used price
            const aliceNewAssetActualBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            const diff = aliceNewAssetPrevBalance.sub(aliceNewAssetActualBalance);
            assertPrec("95.454545454545454545", diff);
          });
        });
      });
    });
  });
});
