import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { fluxCapacitorBehavior } from "../behaviors/fluxCapacitor.behavior";
import { tpParams } from "../helpers/utils";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase Flux capacitor", function () {
  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
    });
    fluxCapacitorBehavior();
  });
});
