import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { caInjectionBehavior } from "../../behaviors/caInjection.behavior";
import { tpParams } from "../../helpers/utils";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocCARC20 allows for collateral injection", function () {
  describe("GIVEN a MocCARC20 implementation deployed", function () {
    before(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
    });
    caInjectionBehavior();
  });
});
