import { fixtureDeployedMocCABag } from "./fixture";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { successFeeBehavior } from "../behaviors/successFee.behavior";
import { tpParams } from "../helpers/utils";

describe("Feature: MocCABag success fee distribution", function () {
  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCABag(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCARBag(this.mocContracts);
    });
    successFeeBehavior();
  });
});
