import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { swapTPforTPBehavior } from "../behaviors/swapTPforTP.behavior";
import { swapTPforTPQueueBehavior } from "../behaviors/queue/swapTPforTPQueue.behavior";
import { tpParams } from "../helpers/utils";
import { fixtureDeployedMocRC20 } from "./fixture";

describe("Feature: MocCARC20 swap TP for TP", function () {
  describe("GIVEN a MocCARC20 implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    swapTPforTPBehavior();
  });
  describe("GIVEN a MocCARC20 implementation deployed behind MocQueue", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams, false);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    swapTPforTPQueueBehavior();
  });
});
