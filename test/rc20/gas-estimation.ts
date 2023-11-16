import { mocFunctionsRC20Deferred } from "../helpers/mocFunctionsRC20Deferred";
import { gasEstimationBehavior } from "../behaviors/gas-estimation-queue.behavior";
import { fixtureDeployedMocRC20 } from "./fixture";

// Gets excluded from coverage by regEx "gas estimation"
describe("Feature: MocCARC20 gas estimation", function () {
  describe("GIVEN a MocCARC20 implementation deployed", function () {
    const peggedTokenAmount = 15;
    describe(`AND ${peggedTokenAmount} Pegged Tokens`, function () {
      beforeEach(async function () {
        const fixtureDeploy = fixtureDeployedMocRC20(peggedTokenAmount, undefined, true);
        this.mocContracts = await fixtureDeploy();
        this.mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
      });
      gasEstimationBehavior();
    });
  });
});
