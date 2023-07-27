import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { shouldBehaveLikeLiquidable } from "../../behaviors/liquidation.behavior";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocRC20Deferred Liquidation", function () {
  describe("GIVEN a MocRC20Deferred implementation deployed with two Pegs", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(2);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
    });
    shouldBehaveLikeLiquidable();
  });
});
