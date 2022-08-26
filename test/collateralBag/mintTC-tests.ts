import { fixtureDeployedMocCARBag } from "./fixture";
import { ERC20Mock, MocCARC20, MocCAWrapper, MocRC20 } from "../../typechain";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { mintTCBehavior } from "../behaviors/mintTC.behavior";

describe("Feature: MocCARBag mint TC", function () {
  let mocCore: MocCARC20;
  let mocWrapper: MocCAWrapper;
  let wcaToken: MocRC20;
  let mocCollateralToken: MocRC20;
  let asset: ERC20Mock;

  describe("GIVEN a MocCARBag implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCARBag(0);
      ({ mocCore, mocWrapper, mocCollateralToken, wcaToken, asset } = await fixtureDeploy());
      this.mocFunctions = await mocFunctionsCARBag({ mocCore, mocCollateralToken, mocWrapper, wcaToken }, asset);
      this.mocContracts = { mocCore, mocWrapper, mocCollateralToken };
    });
    mintTCBehavior();
  });
});
