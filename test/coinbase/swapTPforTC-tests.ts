import { mocFunctionsCoinbaseDeferred } from "../helpers/mocFunctionsCoinbaseDeferred";
import { swapTPforTCBehavior } from "../behaviors/swapTPforTC.behavior";
import { tpParams } from "../helpers/utils";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase swap TP for TC", function () {
  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbaseDeferred(this.mocContracts);
    });
    swapTPforTCBehavior();
  });
});
