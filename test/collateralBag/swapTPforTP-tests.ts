import { fixtureDeployedMocCABag } from "./fixture";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { swapTPforTPBehavior } from "../behaviors/swapTPforTP.behavior";
import { tpParams } from "../helpers/utils";

describe("Feature: MocCABag swap TP for TP", function () {
  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      this.mocContracts = await fixtureDeployedMocCABag(tpParams.length, tpParams)();
      this.mocFunctions = await mocFunctionsCARBag(this.mocContracts);
      swapTPforTPBehavior();
    });
  });
});
