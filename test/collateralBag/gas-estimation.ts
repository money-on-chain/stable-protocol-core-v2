import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { gasEstimationBehavior } from "../behaviors/gas-estimation.behavior";
import { fixtureDeployedMocCABag } from "./fixture";

// Gets excluded from coverage by regEx "gas estimation"
describe("Feature: MocCABag gas estimation", function () {
  describe("GIVEN a MocCABag implementation deployed", function () {
    const peggedTokenAmount = 15;
    const assetAmount = 5;
    describe(`AND ${peggedTokenAmount} Pegged Tokens and ${assetAmount} Assets added in the collateral bag`, function () {
      beforeEach(async function () {
        const fixtureDeploy = fixtureDeployedMocCABag(peggedTokenAmount, undefined, assetAmount);
        this.mocContracts = await fixtureDeploy();
        this.mocFunctions = await mocFunctionsCARBag(this.mocContracts);
      });
      gasEstimationBehavior();
    });
  });
});
