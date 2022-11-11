import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { mintTCandTPBehavior } from "../behaviors/mintTCandTP.behavior";
import { tpParams } from "../helpers/utils";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase mint TC and TP", function () {
  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
    });
    mintTCandTPBehavior();
  });
});
