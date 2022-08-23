import { fixtureDeployedMocCoinbase } from "./fixture";
import { MocCACoinbase, MocRC20 } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { mintTCSharedBehaviour } from "../shared-behaviours/mintTCSharedBehaviour";

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
    mintTCSharedBehaviour();
  });
});
