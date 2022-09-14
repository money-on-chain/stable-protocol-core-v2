import { fixtureDeployedMocCABag } from "./fixture";
import { ERC20Mock, MocCAWrapper } from "../../typechain";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { redeemTPBehavior } from "../behaviors/redeemTP.behavior";
import { deployAsset, ERRORS } from "../helpers/utils";
import { expect } from "chai";

describe("Feature: MocCABag redeem TP", function () {
  let mocWrapper: MocCAWrapper;
  let mocFunctions: any;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      this.mocContracts = await fixtureDeployedMocCABag(1)();
      mocFunctions = await mocFunctionsCARBag(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({ mocWrapper } = this.mocContracts);
    });
    redeemTPBehavior();

    describe("WHEN redeem TP using an asset not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because asset is invalid", async () => {
        await expect(mocWrapper.redeemTP(assetNotWhitelisted.address, 0, 10, 10)).to.be.revertedWithCustomError(
          mocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
  });
});
