import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { successFeeBehavior } from "../behaviors/successFee.behavior";
import { tpParams } from "../helpers/utils";
import { fixtureDeployedMocRC20 } from "./fixture";

describe("Feature: MocCABag success fee distribution", function () {
  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    successFeeBehavior();
  });
});
