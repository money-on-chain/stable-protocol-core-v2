import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { caInjectionBehavior } from "../behaviors/caInjection.behavior";
import { fixtureDeployedMocRC20 } from "./fixture";

describe.skip("Feature: MocRC20 allows for collateral injection", function () {
  describe("GIVEN a MocRC20 implementation deployed", function () {
    before(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(1);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    caInjectionBehavior();
  });
});
