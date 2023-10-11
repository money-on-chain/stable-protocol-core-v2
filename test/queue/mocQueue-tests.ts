import { expect } from "chai";
import { getNamedAccounts } from "hardhat";
import { ContractTransaction, BigNumber } from "ethers";
import { Address } from "hardhat-deploy/types";
import { mocFunctionsRC20Deferred } from "../helpers/mocFunctionsRC20Deferred";
import { OperType, tpParams } from "../helpers/utils";
import { MocCARC20Deferred, MocQueue } from "../../typechain";
import { fixtureDeployedMocRC20Deferred } from "../rc20/deferred/fixture";

describe("Feature: MocQueue with a MocCARC20Deferred bucket", function () {
  let mocFunctions: any;
  let deployer: Address;

  describe("GIVEN a MocQueue MocCARC20Deferred implementation deployed", function () {
    let mocImpl: MocCARC20Deferred;
    let mocQueue: MocQueue;
    let operId: BigNumber;
    let alice: Address;
    let bob: Address;
    beforeEach(async function () {
      ({ deployer, alice, bob } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20Deferred(mocContracts);
      ({ mocImpl, mocQueue } = mocContracts);
    });

    describe("WHEN both Alice and Bob register a valid operation", function () {
      let queueTxAlice: ContractTransaction;
      let queueTxBob: ContractTransaction;
      let executeTx: ContractTransaction;
      let executor: Address;
      beforeEach(async function () {
        executor = deployer;
        operId = await mocQueue.operIdCount();
        queueTxAlice = await mocFunctions.mintTC({ from: alice, qTC: 10, qACmax: 100, execute: false });
        queueTxBob = await mocFunctions.mintTC({ from: bob, qTC: 10, qACmax: 100, execute: false });
      });
      it("THEN two operation queued event are emitted", async function () {
        await expect(queueTxAlice)
          .to.emit(mocQueue, "OperationQueued")
          .withArgs(mocImpl.address, operId, OperType.mintTC);
        await expect(queueTxBob)
          .to.emit(mocQueue, "OperationQueued")
          .withArgs(mocImpl.address, operId.add(1), OperType.mintTC);
      });
      describe("AND queue is executed by an authorized executor", function () {
        beforeEach(async function () {
          executeTx = await mocFunctions.executeQueue({ from: executor });
        });
        it("THEN two operation executed event are emitted", async function () {
          await expect(executeTx).to.emit(mocQueue, "OperationExecuted").withArgs(executor, operId);
          await expect(executeTx).to.emit(mocQueue, "OperationExecuted").withArgs(executor, operId.add(1));
        });
      });
    });
  });
});
