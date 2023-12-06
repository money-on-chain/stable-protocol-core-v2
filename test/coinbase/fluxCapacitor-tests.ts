import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { fluxCapacitorBehavior } from "../behaviors/fluxCapacitor.behavior";
import { tpParams } from "../helpers/utils";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase Flux capacitor", function () {
  describe("GIVEN a MocCoinbase implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
      // on flux capacitor tests all the operations happens in the same block, we need waiting blocks on 0
      await this.mocContracts.mocQueue.setMinOperWaitingBlk(0);
    });
    fluxCapacitorBehavior();
  });
});
