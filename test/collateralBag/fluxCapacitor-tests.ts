import { mocFunctionsCABag } from "../helpers/mocFunctionsCABag";
import { fluxCapacitorBehavior } from "../behaviors/fluxCapacitor.behavior";
import { tpParams } from "../helpers/utils";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag Flux capacitor", function () {
  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCABag(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCABag(this.mocContracts);
    });
    fluxCapacitorBehavior();
  });
});
