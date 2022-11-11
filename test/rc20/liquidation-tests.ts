import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { shouldBehaveLikeLiquidable } from "../behaviors/liquidation.behavior";
import { fixtureDeployedMocRC20 } from "./fixture";

describe("Feature: MocRC20 Liquidation", function () {
  describe("GIVEN a MocRC20 implementation deployed with two Pegs", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(2);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    shouldBehaveLikeLiquidable();
  });
});
