import { mocFunctionsCoinbaseDeferred } from "../helpers/mocFunctionsCoinbaseDeferred";
import { feeTokenBehavior } from "../behaviors/feeToken.behavior";
import { tpParams } from "../helpers/utils";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase Fee Token", function () {
  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbaseDeferred(this.mocContracts);
    });
    feeTokenBehavior();
  });
});
