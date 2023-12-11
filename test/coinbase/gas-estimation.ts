import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { gasEstimationBehavior } from "../behaviors/gas-estimation-queue.behavior";
import { fixtureDeployedMocCoinbase } from "./fixture";

// Gets excluded from coverage by regEx "gas estimation"
describe("Feature: MocCoinbase gas estimation", function () {
  describe("GIVEN a MocCoinbase implementation deployed with mocQueueMock", function () {
    const peggedTokenAmount = 5;
    describe(`AND ${peggedTokenAmount} Pegged Tokens`, function () {
      beforeEach(async function () {
        const fixtureDeploy = fixtureDeployedMocCoinbase(peggedTokenAmount, undefined, true);
        this.mocContracts = await fixtureDeploy();
        this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
      });
      gasEstimationBehavior();
    });
  });
});
