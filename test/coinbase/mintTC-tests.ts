import { fixtureDeployedMocCoinbase } from "./fixture";
import { MocCACoinbase, MocRC20 } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { mintTCBehavior } from "../behaviors/mintTC.behavior";

describe("Feature: MocCoinbase mint CT", function () {
  let mocCore: MocCACoinbase;
  let mocCollateralToken: MocRC20;

  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(0);
      ({ mocCore, mocCollateralToken } = await fixtureDeploy());
      this.mocFunctions = await mocFunctionsCoinbase({ mocCore, mocCollateralToken });
      this.mocContracts = { mocCore, mocCollateralToken };
    });
    mintTCBehavior();
  });
});
