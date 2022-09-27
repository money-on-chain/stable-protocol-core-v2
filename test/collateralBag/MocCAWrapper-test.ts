import { fixtureDeployedMocCABag } from "./fixture";
import { ERC20Mock, MocCAWrapper, PriceProviderMock } from "../../typechain";
import { deployAsset, deployPriceProvider, pEth, CONSTANTS, ERRORS } from "../helpers/utils";
import { expect } from "chai";
import { ContractTransaction } from "ethers";

describe("Feature: MocCAWrapper", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let asset00: ERC20Mock;
  let priceProvider00: PriceProviderMock;

  describe("GIVEN a MocCAWrapper implementation deployed", function () {
    before(async function () {
      const fixtureDeploy = fixtureDeployedMocCABag(0);
      ({ mocWrapper, assetDefault } = await fixtureDeploy());
      asset00 = await deployAsset();
      priceProvider00 = await deployPriceProvider(pEth(1));
    });
    describe("WHEN add an asset twice", () => {
      it("THEN tx fails because asset is already added", async () => {
        await expect(mocWrapper.addAsset(assetDefault.address, priceProvider00.address)).to.be.revertedWithCustomError(
          mocWrapper,
          ERRORS.ASSET_ALREADY_ADDED,
        );
      });
    });
    describe("WHEN add an asset with invalid asset address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(
          mocWrapper.addAsset(CONSTANTS.ZERO_ADDRESS, priceProvider00.address),
        ).to.be.revertedWithCustomError(mocWrapper, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN add an asset with invalid price provider address", () => {
      // revert without reason string trying to peek price to address zero
      it("THEN tx fails because address is the zero address", async () => {
        await expect(mocWrapper.addAsset(asset00.address, CONSTANTS.ZERO_ADDRESS)).to.be.reverted;
      });
    });
    describe("WHEN add an asset with a deprecated price provider", () => {
      let deprecatedPriceProvider: PriceProviderMock;
      before(async () => {
        deprecatedPriceProvider = await deployPriceProvider(pEth(1));
        await deprecatedPriceProvider.deprecatePriceProvider();
      });
      it("THEN tx fails because address is invalid", async () => {
        await expect(
          mocWrapper.addAsset(asset00.address, deprecatedPriceProvider.address),
        ).to.be.revertedWithCustomError(mocWrapper, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN an asset is added", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        tx = await mocWrapper.addAsset(asset00.address, priceProvider00.address);
      });
      it("THEN an AssetAddedOrModified event is emitted", async () => {
        // asset: asset00
        // priceProvider: priceProvider00
        await expect(tx).to.emit(mocWrapper, "AssetAddedOrModified").withArgs(asset00.address, priceProvider00.address);
      });
    });
  });
});
