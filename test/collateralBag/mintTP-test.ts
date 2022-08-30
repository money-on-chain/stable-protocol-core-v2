import { fixtureDeployedMocCABag } from "./fixture";
import { ERC20Mock, MocCARC20, MocCAWrapper, MocRC20 } from "../../typechain";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { mintTPBehavior } from "../behaviors/mintTP.behavior";
import { deployAsset, ERRORS } from "../helpers/utils";
import { expect } from "chai";

describe("Feature: MocCABag mint TP", function () {
  let mocImpl: MocCARC20;
  let mocWrapper: MocCAWrapper;
  let wcaToken: MocRC20;
  let mocCollateralToken: MocRC20;
  let mocPeggedTokens: MocRC20[];
  let asset: ERC20Mock;
  let mocFunctions: any;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCABag(5);
      ({ mocImpl, mocWrapper, mocCollateralToken, mocPeggedTokens, wcaToken, asset } = await fixtureDeploy());
      mocFunctions = await mocFunctionsCARBag(
        { mocImpl, mocCollateralToken, mocPeggedTokens, mocWrapper, wcaToken },
        asset,
      );
      this.mocFunctions = mocFunctions;
      this.mocContracts = { mocImpl, mocWrapper, mocCollateralToken };
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

    /* describe("GIVEN 100 TP minted with asset at 1:1 price", () => {
      let newAsset: ERC20Mock;
      let newPriceProvider: PriceProviderMock;
      beforeEach(async () => {
        //add collateral
        await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
        await mocFunctions.mintTP({ i: 0, from: alice, qTP: 100 });
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
            await mocFunctions.mintTP({ i: 0, from: alice, qTP: 100, asset: newAsset });
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
            await mocFunctions.mintTP({ i: 0, from: alice, qTP: 100, asset: newAsset });
          });
          it("THEN alice spent 95.45 new asset instead of 105", async () => {
            //asset spent = 105 currency needed / 1.1 asset used price
            const aliceNewAssetActualBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            const diff = aliceNewAssetPrevBalance.sub(aliceNewAssetActualBalance);
            assertPrec("95.454545454545454545", diff);
          });
        });
      });
    });*/
  });
});
