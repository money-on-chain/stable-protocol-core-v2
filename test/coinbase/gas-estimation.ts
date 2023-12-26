import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { simParams } from "../helpers/utils";
import { gasEstimationBehavior } from "../behaviors/gas-estimation-queue.behavior";
import { fixtureDeployedMocCoinbase } from "./fixture";

// Gets excluded from coverage by regEx "gas estimation"
describe("Feature: MocCoinbase gas estimation", function () {
  describe("GIVEN a MocCoinbase implementation deployed with mocQueueMock", function () {
    const { tpAmount } = simParams();
    describe(`AND ${tpAmount} Pegged Tokens`, function () {
      beforeEach(async function () {
        const fixtureDeploy = fixtureDeployedMocCoinbase(tpAmount, undefined, true);
        this.mocContracts = await fixtureDeploy();
        this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
      });
      gasEstimationBehavior();
    });
  });
});
