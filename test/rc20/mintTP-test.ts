import { fixtureDeployedMocRC20 } from "./fixture";
import { ERC20Mock, MocCARC20, MocRC20 } from "../../typechain";
import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { mintTPBehavior } from "../behaviors/mintTP.behavior";

describe("Feature: MocCARC20 mint TP", function () {
  let mocImpl: MocCARC20;
  let mocCollateralToken: MocRC20;
  let mocPeggedTokens: MocRC20[];
  let collateralAsset: ERC20Mock;

  describe("GIVEN a MocCARC20 implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(5);
      ({ mocImpl, mocCollateralToken, mocPeggedTokens, collateralAsset } = await fixtureDeploy());
      this.mocFunctions = await mocFunctionsRC20({ mocImpl, mocCollateralToken, mocPeggedTokens }, collateralAsset);
      this.mocContracts = { mocImpl, mocCollateralToken };
    });
    mintTPBehavior();
  });
});
