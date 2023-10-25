import { expect } from "chai";
import hre, { getNamedAccounts } from "hardhat";
import { ContractTransaction, BigNumber } from "ethers";
import { Address } from "hardhat-deploy/types";
import { mocFunctionsRC20Deferred } from "../helpers/mocFunctionsRC20Deferred";
import {
  Balance,
  CONSTANTS,
  ENQUEUER_ROLE,
  EXECUTOR_ROLE,
  OperType,
  ethersGetBalance,
  tpParams,
} from "../helpers/utils";
import { MocCARC20Deferred, MocQueue } from "../../typechain";
import { fixtureDeployedMocRC20Deferred } from "../rc20/deferred/fixture";
import { getNetworkDeployParams } from "../../scripts/utils";

describe("Feature: MocQueue with a MocCARC20Deferred bucket", function () {
  const vendor = CONSTANTS.ZERO_ADDRESS;
  const { execFeeParams } = getNetworkDeployParams(hre).queueParams;
  let mocFunctions: any;
  let deployer: Address;
  let executor: Address;

  describe("GIVEN a MocQueue MocCARC20Deferred implementation deployed", function () {
    let mocImpl: MocCARC20Deferred;
    let mocQueue: MocQueue;
    let tp: Address;
    let operId: BigNumber;
    let alice: Address;
    let bob: Address;
    let executorBalanceBefore: Balance;
    let expectEnqueuerRevert: (queueTx: Promise<ContractTransaction>) => any;
    let commonParams: { sender: Address; recipient: Address; vendor: Address };
    beforeEach(async function () {
      ({ deployer, alice, bob } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20Deferred(mocContracts);

      ({
        mocImpl,
        mocQueue,
        mocPeggedTokens: [{ address: tp }],
      } = mocContracts);
      commonParams = { sender: alice, recipient: bob, vendor };
      expectEnqueuerRevert = queuePromise =>
        expect(queuePromise).to.be.revertedWith(
          `AccessControl: account ${deployer.toLowerCase()} is missing role ${ENQUEUER_ROLE}`,
        );
    });
    describe("WHEN executing an empty queue", function () {
      it("THEN it has no effect", async function () {
        await mocFunctions.executeQueue();
      });
    });
    describe("WHEN an unauthorized account tries to queue a mint TC Operation", function () {
      it("THEN transaction fails with missing role error", async function () {
        await expectEnqueuerRevert(mocQueue.queueMintTC({ qTC: 1, qACmax: 1, ...commonParams }));
      });
    });
    describe("WHEN an unauthorized account tries to queue a redeem TC Operation", function () {
      it("THEN transaction fails with missing role error", async function () {
        await expectEnqueuerRevert(mocQueue.queueRedeemTC({ qTC: 1, qACmin: 1, ...commonParams }));
      });
    });
    describe("WHEN an unauthorized account tries to queue a mint TP Operation", function () {
      it("THEN transaction fails with missing role error", async function () {
        await expectEnqueuerRevert(mocQueue.queueMintTP({ tp, qTP: 1, qACmax: 1, ...commonParams }));
      });
    });
    describe("WHEN an unauthorized account tries to queue a redeem TP Operation", function () {
      it("THEN transaction fails with missing role error", async function () {
        await expectEnqueuerRevert(mocQueue.queueRedeemTP({ tp, qTP: 1, qACmin: 1, ...commonParams }));
      });
    });
    describe("WHEN an unauthorized account tries to queue a mint TPandTC Operation", function () {
      it("THEN transaction fails with missing role error", async function () {
        await expectEnqueuerRevert(mocQueue.queueMintTCandTP({ tp, qTP: 1, qACmax: 1, ...commonParams }));
      });
    });
    describe("WHEN an unauthorized account tries to queue a redeem TPandTC Operation", function () {
      it("THEN transaction fails with missing role error", async function () {
        await expectEnqueuerRevert(mocQueue.queueRedeemTCandTP({ tp, qTC: 1, qTP: 1, qACmin: 1, ...commonParams }));
      });
    });
    describe("WHEN an unauthorized account tries to queue a swap TCforTP Operation", function () {
      it("THEN transaction fails with missing role error", async function () {
        await expectEnqueuerRevert(mocQueue.queueSwapTCforTP({ tp, qTC: 1, qTPmin: 1, qACmax: 1, ...commonParams }));
      });
    });
    describe("WHEN an unauthorized account tries to queue a swap TPforTC Operation", function () {
      it("THEN transaction fails with missing role error", async function () {
        await expectEnqueuerRevert(mocQueue.queueSwapTPforTC({ tp, qTP: 1, qTCmin: 1, qACmax: 1, ...commonParams }));
      });
    });
    describe("WHEN an unauthorized account tries to queue a swap TPforTP Operation", function () {
      it("THEN transaction fails with missing role error", async function () {
        await expectEnqueuerRevert(
          mocQueue.queueSwapTPforTP({ tpFrom: tp, tpTo: tp, qTP: 1, qTPmin: 1, qACmax: 1, ...commonParams }),
        );
      });
    });
    describe("WHEN both Alice and Bob register a valid operation", function () {
      let queueTxAlice: ContractTransaction;
      let queueTxBob: ContractTransaction;
      let execTx: ContractTransaction;
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
      it("THEN mocQueue receives coinbase for those two operations", async function () {
        const mocQueueBalance = await ethersGetBalance(mocQueue.address);
        await expect(mocQueueBalance).to.be.equal(execFeeParams.tcMintExecFee.mul(2));
      });
      it("THEN if an unauthorized user tries to execute the queue, it fails", async function () {
        await expect(mocFunctions.executeQueue({ from: bob })).to.be.revertedWith(
          `AccessControl: account ${bob.toLowerCase()} is missing role ${EXECUTOR_ROLE}`,
        );
      });
      describe("AND queue is executed by an authorized executor", function () {
        beforeEach(async function () {
          executorBalanceBefore = await ethersGetBalance(deployer);
          execTx = await mocFunctions.executeQueue({ from: executor });
        });
        it("THEN two operation executed event are emitted", async function () {
          await expect(execTx).to.emit(mocQueue, "OperationExecuted").withArgs(executor, operId);
          await expect(execTx).to.emit(mocQueue, "OperationExecuted").withArgs(executor, operId.add(1));
        });
        it("THEN execution Fees are delivered", async function () {
          const mocQueueBalance = await ethersGetBalance(mocQueue.address);
          await expect(mocQueueBalance).to.be.equal(0);
          const executorBalanceAfter = await ethersGetBalance(deployer);
          await expect(executorBalanceAfter).to.be.equal(execFeeParams.tcMintExecFee.mul(2).add(executorBalanceBefore));
        });
      });
    });
    describe("WHEN Bob registers an invalid operation, and Alice a valid afterwards", function () {
      let execTx: ContractTransaction;
      beforeEach(async function () {
        executor = deployer;
        executorBalanceBefore = await ethersGetBalance(executor);
        operId = await mocQueue.operIdCount();
        await mocFunctions.mintTC({ from: bob, qTC: 10, qACmax: 1, execute: false });
        await mocFunctions.mintTC({ from: alice, qTC: 10, qACmax: 100, execute: false });
      });
      describe("AND queue is executed", function () {
        beforeEach(async function () {
          execTx = await mocFunctions.executeQueue({ from: executor });
        });
        it("THEN one OperationError event is emitted for Bob", async function () {
          await expect(execTx).to.emit(mocQueue, "OperationError");
        });
        it("THEN two operation executed event are emitted", async function () {
          await expect(execTx).to.emit(mocQueue, "OperationExecuted").withArgs(executor, operId);
          await expect(execTx).to.emit(mocQueue, "OperationExecuted").withArgs(executor, operId.add(1));
        });
        it("THEN execution Fees are delivered the same", async function () {
          const mocQueueBalance = await ethersGetBalance(mocQueue.address);
          await expect(mocQueueBalance).to.be.equal(0);
          const executorBalanceAfter = await ethersGetBalance(deployer);
          await expect(executorBalanceAfter).to.be.equal(execFeeParams.tcMintExecFee.mul(2).add(executorBalanceBefore));
        });
      });
    });
    describe("WHEN if more than max batch size valid operations are queued", function () {
      let execTx: ContractTransaction;
      const maxSize = 10;
      beforeEach(async function () {
        executor = deployer;
        operId = await mocQueue.operIdCount();
        await Promise.all(
          Array.from(Array(maxSize + 1).keys()).map(i =>
            mocFunctions.mintTC({ from: i % 2 == 0 ? alice : bob, qTC: i, execute: false }),
          ),
        );
      });
      describe("AND queue is executed", function () {
        beforeEach(async function () {
          execTx = await mocFunctions.executeQueue({ from: executor });
          //const gasUsed = (await execTx.wait()).gasUsed.toNumber();
          //console.log("GAS USED ON FULL QUEUE EXEC:", gasUsed);
        });
        it("THEN only max batch size operations are executed", async function () {
          await expect(execTx)
            .to.emit(mocQueue, "OperationExecuted")
            .withArgs(executor, operId.add(maxSize - 1));
          await expect(await mocQueue.firstOperId()).to.be.equal(operId.add(maxSize));
        });
        describe("AND if queue is executed again", function () {
          beforeEach(async function () {
            execTx = await mocFunctions.executeQueue({ from: executor });
          });
          it("THEN the remaining operations are executed", async function () {
            await expect(execTx).to.emit(mocQueue, "OperationExecuted").withArgs(executor, operId.add(maxSize));
            await expect(await mocQueue.firstOperId()).to.be.equal(operId.add(maxSize + 1));
          });
        });
      });
    });
  });
});
