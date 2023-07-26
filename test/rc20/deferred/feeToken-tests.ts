import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { feeTokenBehavior } from "../../behaviors/feeToken.behavior";
import { tpParams } from "../../helpers/utils";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocCARC20Deferred Fee Token", function () {
  describe("GIVEN a MocCARC20Deferred implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
    });
    feeTokenBehavior();
  });
});
