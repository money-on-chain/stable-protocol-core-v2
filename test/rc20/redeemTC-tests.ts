import { fixtureDeployedMocRC20 } from "./fixture";
import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { redeemTCBehavior } from "../behaviors/redeemTC.behavior";

describe("Feature: MocCARC20 redeem TC", function () {
  describe("GIVEN a MocCARC20 implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(1);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    redeemTCBehavior();
  });
});
