import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { simParams } from "../helpers/utils";
import { gasEstimationBehavior } from "../behaviors/gas-estimation-queue.behavior";
import { gasEstimationExecSizeBehavior } from "../behaviors/gas-estimation-queue-size.behavior";
import { gasEstimationExecBehavior } from "../behaviors/gas-estimation-exec.behavior";
import { fixtureDeployedMocRC20 } from "./fixture";

// Gets excluded from coverage by regEx "gas estimation"
describe("Feature: MocCARC20 queuing gas estimation", function () {
  const { tpAmount } = simParams();
  describe(`GIVEN a MocCARC2 implementation deployed with ${tpAmount} Pegged Tokens`, async function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpAmount);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    gasEstimationBehavior();
  });
});
describe("Feature: MocCARC20 execution gas estimation", function () {
  const {
    execFee: { tpAmount, iter, avgOperPerBatch },
  } = simParams();
  // Will simulate iter amount of "random" Operations for each type, with the queue
  // filled with "avgOperPerBatch" on each batch execution
  describe(`GIVEN a queue simulation with ${tpAmount} Pegged Tokens, ${iter} iterations and ${avgOperPerBatch} average Operations per batch`, function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpAmount);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    gasEstimationExecBehavior(tpAmount, iter, avgOperPerBatch);
  });
});
describe("Feature: MocQueue with MocCARC20 batch size gas estimation", function () {
  const {
    batchSize: { tpAmount, operPerBatch },
  } = simParams();
  describe(`GIVEN a queue simulation with ${tpAmount} Pegged Tokens, and ${operPerBatch} Operations batch`, function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpAmount);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
      await this.mocContracts.mocQueue.setMaxOperPerBatch(1000);
    });
    gasEstimationExecSizeBehavior(tpAmount, operPerBatch);
  });
});
