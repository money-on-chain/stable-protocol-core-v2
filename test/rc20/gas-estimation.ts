import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { gasEstimationBehavior } from "../behaviors/gas-estimation.behavior";
import { fixtureDeployedMocRC20 } from "./fixture";

// Gets excluded from coverage by regEx "gas estimation"
describe("Feature: MocCRC20 gas estimation", function () {
  describe("GIVEN a MocCRC20 implementation deployed", function () {
    const peggedTokenAmount = 15;
    describe(`AND ${peggedTokenAmount} Pegged Tokens`, function () {
      beforeEach(async function () {
        const fixtureDeploy = fixtureDeployedMocRC20(peggedTokenAmount);
        this.mocContracts = await fixtureDeploy();
        this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
      });
      gasEstimationBehavior();
    });
  });
});
