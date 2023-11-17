import { mocFunctionsRC20Deferred } from "../helpers/mocFunctionsRC20Deferred";
import { gasEstimationBehavior } from "../behaviors/gas-estimation-queue.behavior";
import { gasEstimationExecSizeBehavior } from "../behaviors/gas-estimation-queue-size.behavior";
import { gasEstimationExecBehavior } from "../behaviors/gas-estimation-exec.behavior";
import { fixtureDeployedMocRC20 } from "./fixture";

// Gets excluded from coverage by regEx "gas estimation"
describe("Feature: MocCRC20Deferred queuing gas estimation", function () {
  describe("GIVEN a MocCRC20Deferred implementation deployed", function () {
    const peggedTokenAmount = 5;
    describe(`AND ${peggedTokenAmount} Pegged Tokens`, function () {
      beforeEach(async function () {
        const fixtureDeploy = fixtureDeployedMocRC20(peggedTokenAmount);
        this.mocContracts = await fixtureDeploy();
        this.mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
      });
      gasEstimationBehavior();
    });
  });
});
describe("Feature: MocCRC20Deferred execution gas estimation", function () {
  const peggedTokenAmount = 1;
  // Will simulate this amount of "random" Operations for each type
  const iter = 10;
  // Will simulate this amount of queued Operations on each execution
  const avgOperPerBatch = 1;
  describe(`GIVEN a queue simulation with ${peggedTokenAmount} Pegged Tokens, ${iter} iterations and ${avgOperPerBatch} average Operations per batch`, function () {
    describe(` ${peggedTokenAmount} Pegged Tokens`, function () {
      beforeEach(async function () {
        const fixtureDeploy = fixtureDeployedMocRC20(peggedTokenAmount);
        this.mocContracts = await fixtureDeploy();
        this.mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
      });
      gasEstimationExecBehavior(peggedTokenAmount, iter, avgOperPerBatch);
    });
  });
});
describe("Feature: MocQueue with MocCRC20Deferred batch size gas estimation", function () {
  const peggedTokenAmount = 1;
  // Will simulate this amount of queued Operations on each execution
  const avgOperPerBatch = 65;
  describe(`GIVEN a queue simulation with ${peggedTokenAmount} Pegged Tokens, and ${avgOperPerBatch} Operations batch`, function () {
    describe(` ${peggedTokenAmount} Pegged Tokens`, function () {
      beforeEach(async function () {
        const fixtureDeploy = fixtureDeployedMocRC20(peggedTokenAmount);
        this.mocContracts = await fixtureDeploy();
        this.mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
        await this.mocContracts.mocQueue.setMaxOperPerBatch(1000);
      });
      gasEstimationExecSizeBehavior(peggedTokenAmount, avgOperPerBatch);
    });
  });
});
