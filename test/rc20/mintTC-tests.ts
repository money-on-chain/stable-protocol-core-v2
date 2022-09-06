import { fixtureDeployedMocRC20 } from "./fixture";
import { ERC20Mock, MocCARC20, MocRC20, PriceProviderMock } from "../../typechain";
import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { mintTCBehavior } from "../behaviors/mintTC.behavior";
import { CONSTANTS } from "../helpers/utils";
import { expect } from "chai";

describe("Feature: MocCARC20 mint TC", function () {
  let mocImpl: MocCARC20;
  let mocCollateralToken: MocRC20;
  let collateralAsset: ERC20Mock;
  let mocPeggedTokens: MocRC20[];
  let priceProviders: PriceProviderMock[];

  describe("GIVEN a MocCARC20 implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(1);
      ({ mocImpl, mocCollateralToken, collateralAsset, mocPeggedTokens, priceProviders } = await fixtureDeploy());
      this.mocFunctions = await mocFunctionsRC20(
        { mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders },
        collateralAsset,
      );
      this.mocContracts = { mocImpl, mocCollateralToken };
    });
    mintTCBehavior();

    describe("WHEN a user sends almost max uint256 amount of Asset to mint TC", function () {
      it("THEN tx reverts with panic code 0x11 overflow", async function () {
        const qACmax = CONSTANTS.MAX_BALANCE.mul(10);
        await collateralAsset.approve(mocImpl.address, qACmax);
        await expect(mocImpl.mintTC(CONSTANTS.MAX_BALANCE, qACmax)).to.be.revertedWithPanic("0x11");
      });
    });
  });
});
