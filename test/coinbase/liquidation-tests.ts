import { fixtureDeployedMocCoinbase } from "./fixture";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { shouldBehaveLikeLiquidable } from "../behaviors/liquidation.behavior";

describe("Feature: MocCoinbase Liquidation", function () {
  describe("GIVEN a MocCoinbase implementation deployed with two Pegs", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(2);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
    });
    shouldBehaveLikeLiquidable();
  });
});
