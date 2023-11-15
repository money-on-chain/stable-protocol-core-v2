import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { feeTokenBehavior } from "../behaviors/feeToken.behavior";
import { tpParams } from "../helpers/utils";
import { fixtureDeployedMocRC20 } from "./fixture";

describe.skip("Feature: MocCARC20 Fee Token", function () {
  describe("GIVEN a MocCARC20 implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    feeTokenBehavior();
  });
});
