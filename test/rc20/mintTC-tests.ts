import { fixtureDeployedMocRC20 } from "./fixture";
import { ERC20Mock, MocCARC20, MocRC20 } from "../../typechain";
import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { mintTCBehavior } from "../behaviors/mintTC.behavior";

describe("Feature: MocCARC20 mint TC", function () {
  let mocCore: MocCARC20;
  let mocCollateralToken: MocRC20;
  let collateralAsset: ERC20Mock;

  describe("GIVEN a MocCARC20 implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(0);
      ({ mocCore, mocCollateralToken, collateralAsset } = await fixtureDeploy());
      this.mocFunctions = await mocFunctionsRC20({ mocCore, mocCollateralToken }, collateralAsset);
      this.mocContracts = { mocCore, mocCollateralToken };
    });
    mintTCBehavior();
  });
});
