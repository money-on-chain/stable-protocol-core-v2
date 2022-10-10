import { fixtureDeployedMocCABag } from "./fixture";
import { ERC20Mock, MocCAWrapper } from "../../typechain";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { swapTPforTPBehavior } from "../behaviors/swapTPforTP.behavior";
import { deployAsset, ERRORS } from "../helpers/utils";
import { expect } from "chai";
import { tpParams } from "../helpers/utils";

describe("Feature: MocCABag swap TP for TP", function () {
  let mocWrapper: MocCAWrapper;
  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      this.mocContracts = await fixtureDeployedMocCABag(tpParams.length, tpParams)();
      this.mocFunctions = await mocFunctionsCARBag(this.mocContracts);
      ({ mocWrapper } = this.mocContracts);
    });
    swapTPforTPBehavior();

    describe("WHEN swap TP using an asset not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because asset is invalid", async () => {
        await expect(
          mocWrapper.swapTPforTP(assetNotWhitelisted.address, 0, 1, 10, 0, 10),
        ).to.be.revertedWithCustomError(mocWrapper, ERRORS.INVALID_ADDRESS);
      });
    });
  });
});
