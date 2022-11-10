import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { shouldBehaveLikeLiquidable } from "../behaviors/liquidation.behavior";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag Liquidation", function () {
  describe("GIVEN a MocCABag implementation deployed with two Pegs", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCABag(2);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCARBag(this.mocContracts);
    });
    shouldBehaveLikeLiquidable();
  });
});
