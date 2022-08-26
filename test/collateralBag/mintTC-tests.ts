import { fixtureDeployedMocCARBag } from "./fixture";
import { ERC20Mock, MocCARC20, MocCAWrapper, MocRC20 } from "../../typechain";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { mintTCBehavior } from "../behaviors/mintTC.behavior";
import { deployAsset, ERRORS } from "../helpers/utils";
import { expect } from "chai";

describe("Feature: MocCARBag mint TC", function () {
  let mocCore: MocCARC20;
  let mocWrapper: MocCAWrapper;
  let wcaToken: MocRC20;
  let mocCollateralToken: MocRC20;
  let asset: ERC20Mock;

  describe("GIVEN a MocCARBag implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCARBag(0);
      ({ mocCore, mocWrapper, mocCollateralToken, wcaToken, asset } = await fixtureDeploy());
      this.mocFunctions = await mocFunctionsCARBag({ mocCore, mocCollateralToken, mocWrapper, wcaToken }, asset);
      this.mocContracts = { mocCore, mocWrapper, mocCollateralToken };
    });
    mintTCBehavior();

    describe("WHEN mintTC using an asset not whitelisted", () => {
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
  });
});
