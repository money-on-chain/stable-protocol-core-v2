import { expect } from "chai";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { mintTCandTPBehavior } from "../behaviors/mintTCandTP.behavior";
import { deployAsset, ERRORS, tpParams } from "../helpers/utils";
import { ERC20Mock, MocCAWrapper } from "../../typechain";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag redeem TC and TP", function () {
  let mocWrapper: MocCAWrapper;
  const TP_0 = 0;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCABag(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCARBag(this.mocContracts);
      ({ mocWrapper } = this.mocContracts);
    });
    mintTCandTPBehavior();

    describe("WHEN redeem TC and TP using an asset not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because asset is invalid", async () => {
        await expect(
          mocWrapper.redeemTCandTP(assetNotWhitelisted.address, TP_0, 10, 10, 10),
        ).to.be.revertedWithCustomError(mocWrapper, ERRORS.INVALID_ADDRESS);
      });
    });
  });
});
