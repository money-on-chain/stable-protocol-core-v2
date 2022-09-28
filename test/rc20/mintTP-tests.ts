import { fixtureDeployedMocRC20 } from "./fixture";
import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { mintTPBehavior } from "../behaviors/mintTP.behavior";
import { tpParams } from "../helpers/utils";

describe("Feature: MocCARC20 mint TP", function () {
  describe("GIVEN a MocCARC20 implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    mintTPBehavior();
  });
});
