import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { redeemTPBehavior } from "../behaviors/redeemTP.behavior";
import { redeemTPQueueBehavior } from "../behaviors/queue/redeemTPQueue.behavior";
import { tpParams } from "../helpers/utils";
import { fixtureDeployedMocRC20 } from "./fixture";

describe("Feature: MocCARC20 redeem TP", function () {
  describe("GIVEN a MocCARC20 implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    redeemTPBehavior();
  });
  describe("GIVEN a MocCARC20 implementation deployed behind MocQueue", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams, false);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    redeemTPQueueBehavior();
  });
});
