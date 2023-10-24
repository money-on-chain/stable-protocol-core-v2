import { expect } from "chai";
import { ethers, getNamedAccounts } from "hardhat";
import { ContractTransaction, BigNumber } from "ethers";
import { Address } from "hardhat-deploy/types";
import { mocFunctionsRC20Deferred } from "../helpers/mocFunctionsRC20Deferred";
import { EXECUTOR_ROLE, mineUpTo, tpParams } from "../helpers/utils";
import { MocCARC20Deferred, MocQueue, MocQueue__factory } from "../../typechain";
import { fixtureDeployedMocRC20Deferred } from "../rc20/deferred/fixture";

describe("Feature: MocQueue Operation min waiting Blk", function () {
  let mocFunctions: any;
  let deployer: Address;
  let executor: Address;

  describe("GIVEN a MocQueue with min waiting set to 10 blocks", function () {
    let mocImpl: MocCARC20Deferred;
    let mocQueue: MocQueue;
    let operId: BigNumber;
    let alice: Address;
    let bob: Address;
    beforeEach(async function () {
      ({ deployer, alice, bob } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();

      ({ mocImpl, mocQueue } = mocContracts);

      const mocQueueFactory = await ethers.getContractFactory("MocQueue");
      const mocQueueDeployed = await mocQueueFactory.deploy();

      mocQueue = MocQueue__factory.connect(mocQueueDeployed.address, ethers.provider.getSigner());
      await mocQueue.initialize(await mocImpl.governor(), await mocImpl.pauser(), 10);
      await Promise.all([
        mocImpl.setMocQueue(mocQueue.address),
        mocQueue.registerBucket(mocImpl.address),
        mocQueue.grantRole(EXECUTOR_ROLE, deployer),
      ]);
      mocContracts.mocQueue = mocQueue;
      mocFunctions = await mocFunctionsRC20Deferred(mocContracts);
    });
    describe("WHEN both Alice and Bob register a valid operation", function () {
      let execTx: ContractTransaction;
      let aliceBlock: number;
      let bobBlock: number;
      beforeEach(async function () {
        executor = deployer;
        operId = await mocQueue.operIdCount();
        const aliceTx = await mocFunctions.mintTC({ from: alice, qTC: 10, qACmax: 100, execute: false });
        aliceBlock = aliceTx.blockNumber;
        const bobTx = await mocFunctions.mintTC({ from: bob, qTC: 10, qACmax: 100, execute: false });
        bobBlock = bobTx.blockNumber;
      });
      describe("AND queue is executed", function () {
        beforeEach(async function () {
          execTx = await mocFunctions.executeQueue();
        });
        it("THEN no operation is executed", async function () {
          await expect(execTx).not.to.emit(mocQueue, "OperationExecuted");
        });
        describe("AND queue is executed after a block", function () {
          beforeEach(async function () {
            await mineUpTo(aliceBlock + 10);
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN only Alice operation is executed", async function () {
            await expect(execTx).to.emit(mocQueue, "OperationExecuted").withArgs(executor, operId);
          });
          describe("AND queue is executed after another block", function () {
            beforeEach(async function () {
              await mineUpTo(bobBlock + 10);
              execTx = await mocFunctions.executeQueue();
            });
            it("THEN Bob's operation is executed", async function () {
              await expect(execTx).to.emit(mocQueue, "OperationExecuted").withArgs(executor, operId.add(1));
            });
          });
        });
      });
    });
  });
});
