import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { feeTokenBehavior } from "../../behaviors/deferred/feeToken.behavior";
import { tpParams } from "../../helpers/utils";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocCARC20 Fee Token", function () {
  describe("GIVEN a MocCARC20 implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, false);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
    });
    feeTokenBehavior();
  });
});
