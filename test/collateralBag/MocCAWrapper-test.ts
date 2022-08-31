import { fixtureDeployedMocCABag } from "./fixture";
import { ERC20Mock, MocCAWrapper, PriceProviderMock } from "../../typechain";
import { deployAsset, deployPriceProvider, pEth, CONSTANTS, ERRORS } from "../helpers/utils";
import { expect } from "chai";

describe("Feature: MocCAWrapper", function () {
  let mocWrapper: MocCAWrapper;
  let asset: ERC20Mock;
  let asset00: ERC20Mock;
  let priceProvider00: PriceProviderMock;

  describe("GIVEN a MocCAWrapper implementation deployed", function () {
    before(async function () {
      const fixtureDeploy = fixtureDeployedMocCABag(0);
      ({ mocWrapper, asset } = await fixtureDeploy());
      asset00 = await deployAsset();
      priceProvider00 = await deployPriceProvider(pEth(1));
    });
    describe("WHEN add an asset twice", () => {
      it("THEN tx fails because asset is already added", async () => {
        await expect(mocWrapper.addAsset(asset.address, priceProvider00.address)).to.be.revertedWithCustomError(
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
      it("THEN tx fails because address is the zero address", async () => {
        await expect(mocWrapper.addAsset(asset00.address, CONSTANTS.ZERO_ADDRESS)).to.be.revertedWithCustomError(
          mocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
  });
});
