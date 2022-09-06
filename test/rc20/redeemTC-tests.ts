import { fixtureDeployedMocRC20 } from "./fixture";
import { ERC20Mock, MocCARC20, MocRC20, PriceProviderMock } from "../../typechain";
import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { redeemTCBehavior } from "../behaviors/redeemTC.behavior";

describe("Feature: MocCARC20 redeem TC", function () {
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
    redeemTCBehavior();
  });
});
