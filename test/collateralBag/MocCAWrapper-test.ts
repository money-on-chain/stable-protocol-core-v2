import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { ERC20Mock, MocCAWrapper, PriceProviderMock } from "../../typechain";
import { ERRORS, deployAsset, deployPriceProvider, pEth } from "../helpers/utils";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCAWrapper", function () {
  let mocWrapper: MocCAWrapper;
  let asset00: ERC20Mock;
  let priceProvider00: PriceProviderMock;

  describe("GIVEN a MocCAWrapper implementation deployed", function () {
    before(async function () {
      const fixtureDeploy = fixtureDeployedMocCABag(0);
      ({ mocWrapper } = await fixtureDeploy());
      asset00 = await deployAsset();
      priceProvider00 = await deployPriceProvider(pEth(1));
    });
    describe("WHEN add an asset with a deprecated price provider", () => {
      let deprecatedPriceProvider: PriceProviderMock;
      before(async () => {
        deprecatedPriceProvider = await deployPriceProvider(pEth(1));
        await deprecatedPriceProvider.deprecatePriceProvider();
      });
      it("THEN tx fails because address is invalid", async () => {
        await expect(
          mocWrapper.addOrEditAsset(asset00.address, deprecatedPriceProvider.address),
        ).to.be.revertedWithCustomError(mocWrapper, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN an asset is added", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        tx = await mocWrapper.addOrEditAsset(asset00.address, priceProvider00.address);
      });
      it("THEN an AssetAddedOrModified event is emitted", async () => {
        // asset: asset00
        // priceProvider: priceProvider00
        await expect(tx).to.emit(mocWrapper, "AssetModified").withArgs(asset00.address, priceProvider00.address);
      });
      describe("WHEN the asset price Provider is edited", () => {
        it("THEN a new AssetAddedOrModified event is emitted", async () => {
          const priceProvider01 = await deployPriceProvider(pEth(1.1));
          const editTx = await mocWrapper.addOrEditAsset(asset00.address, priceProvider01.address);
          await expect(editTx).to.emit(mocWrapper, "AssetModified").withArgs(asset00.address, priceProvider01.address);
        });
      });
    });
  });
});
