import { fixtureDeployedMocCoinbase } from "./fixture";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { swapTPforTPBehavior } from "../behaviors/swapTPforTP.behavior";
import { tpParams } from "../helpers/utils";

describe("Feature: MocCoinbase swap TP for TP", function () {
  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
    });
    swapTPforTPBehavior();
  });
});
