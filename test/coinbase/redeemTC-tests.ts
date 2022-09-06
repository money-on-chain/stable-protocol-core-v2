import { fixtureDeployedMocCoinbase } from "./fixture";
import { MocCACoinbase, MocRC20, PriceProviderMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { redeemTCBehavior } from "../behaviors/redeemTC.behavior";

describe("Feature: MocCoinbase redeem TC", function () {
  let mocImpl: MocCACoinbase;
  let mocCollateralToken: MocRC20;
  let mocPeggedTokens: MocRC20[];
  let priceProviders: PriceProviderMock[];

  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(1);
      ({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders } = await fixtureDeploy());
      this.mocFunctions = await mocFunctionsCoinbase({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders });
      this.mocContracts = { mocImpl, mocCollateralToken };
    });
    redeemTCBehavior();
  });
});
