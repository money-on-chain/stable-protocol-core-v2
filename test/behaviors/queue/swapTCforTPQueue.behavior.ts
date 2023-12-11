import hre, { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { assertPrec } from "../../helpers/assertHelper";
import {
  Balance,
  getNetworkDeployParams,
  ERROR_SELECTOR,
  ethersGetBalance,
  OperId,
  OperType,
} from "../../helpers/utils";
import { MocCACoinbase, MocCARC20, MocQueue } from "../../../typechain";

const swapTCforTPQueueBehavior = function () {
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let mocQueue: MocQueue;
  let operId: OperId;
  let executor: Address;
  let alice: Address;
  let bob: Address;
  let assertACResult: any;
  let execTx: ContractTransaction;
  let prevTCBalance: Balance;
  let prevACBalance: Balance;
  const TP_0 = 0;
  const {
    execFeeParams: { swapTCforTPExecFee },
  } = getNetworkDeployParams(hre).queueParams;
  describe("Feature: swap Collateral Token for Pegged Token", function () {
    beforeEach(async function () {
      mocFunctions = this.mocFunctions;
      ({ mocImpl, mocQueue } = this.mocContracts);
      ({ alice, bob, deployer: executor } = await getNamedAccounts());
      assertACResult = mocFunctions.assertACResult(-swapTCforTPExecFee);
    });
    describe("GIVEN Alice has 20 TC", function () {
      let queueTx: ContractTransaction;
      beforeEach(async function () {
        await mocFunctions.mintTCandTP({ from: bob, qTP: 1000 });
        await mocFunctions.mintTC({ from: alice, qTC: 100 });
      });
      describe("WHEN she registers an Operation to swap 12 TC paying max 10 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevTCBalance = await mocFunctions.tcBalanceOf(alice);
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          queueTx = await mocFunctions.swapTCforTP({ from: alice, qTC: 12, qACmax: 10, execute: false });
        });
        it("THEN an operation queued event is emitted", async function () {
          await expect(queueTx)
            .to.emit(mocQueue, "OperationQueued")
            .withArgs(mocImpl.address, operId, OperType.swapTCforTP);
        });
        it("THEN Alice TC balance decreases by 12, as her funds are locked", async function () {
          assertPrec(await mocFunctions.tcBalanceOf(alice), 88);
        });
        it("THEN Bucket balance increases by 12, as the funds are now locked there", async function () {
          assertPrec(await mocFunctions.tcBalanceOf(mocImpl.address), 12);
        });
        it("THEN AC balance locked is 10 AC", async function () {
          assertPrec(await mocImpl.qACLockedInPending(), 10);
        });
        describe("WHEN the operation is executed", function () {
          let executorBalanceBefore: Balance;
          beforeEach(async function () {
            executorBalanceBefore = await ethersGetBalance(executor);
            await mocFunctions.executeQueue();
          });
          it("THEN Alice TC balance doesn't change", async function () {
            assertPrec(await mocFunctions.tcBalanceOf(alice), 88);
          });
          it("THEN Bucket TC balance is back to zero as tokes were burned", async function () {
            assertPrec(await mocFunctions.tcBalanceOf(mocImpl.address), 0);
          });
          it("THEN AC balance locked is 0 AC", async function () {
            assertPrec(await mocImpl.qACLockedInPending(), 0);
          });
          it("THEN queue executor receives the corresponding execution fees", async function () {
            const mocQueueBalance = await ethersGetBalance(mocQueue.address);
            expect(mocQueueBalance).to.be.equal(0);
            const executorBalanceAfter = await ethersGetBalance(executor);
            expect(executorBalanceAfter).to.be.equal(swapTCforTPExecFee.add(executorBalanceBefore));
          });
        });
        describe("AND Pegged Token has been revaluated leaving the protocol below coverage", function () {
          // this test is to check that tx doesn't fail because underflow doing totalACAvailable - lckAC
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, "0.00000001");
          });
          describe("AND execution is evaluated", function () {
            beforeEach(async function () {
              execTx = await mocFunctions.executeQueue();
            });
            it("THEN Operations fails with Low Coverage, and Operation Error event is emitted", async function () {
              await expect(execTx)
                .to.emit(mocQueue, "OperationError")
                .withArgs(operId, ERROR_SELECTOR.LOW_COVERAGE, "Low coverage");
            });
            it("THEN TC and AC are returned", async function () {
              assertPrec(prevTCBalance, await mocFunctions.tcBalanceOf(alice));
              assertACResult(prevACBalance, await mocFunctions.acBalanceOf(alice));
            });
          });
        });
      });
      describe("WHEN she registers an Operation to swap 12 TC with only 0.01 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevTCBalance = await mocFunctions.tcBalanceOf(alice);
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          queueTx = await mocFunctions.swapTCforTP({ from: alice, qTC: 12, qACmax: 0.01, execute: false });
        });
        describe("AND execution is evaluated", function () {
          beforeEach(async function () {
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with Insufficient qac sent, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.INSUFFICIENT_QAC_SENT, "Insufficient qac sent");
          });
          it("THEN TC and AC are returned", async function () {
            assertPrec(prevTCBalance, await mocFunctions.tcBalanceOf(alice));
            assertACResult(prevACBalance, await mocFunctions.acBalanceOf(alice));
          });
        });
      });
      describe("WHEN she registers an Operation to swap 1 TC expecting at least 10000 TPs", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevTCBalance = await mocFunctions.tcBalanceOf(alice);
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          queueTx = await mocFunctions.swapTCforTP({ from: alice, qTC: 1, qTPmin: 10000, execute: false });
        });
        describe("AND execution is evaluated", function () {
          beforeEach(async function () {
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with qTP below minimum required, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.QTP_BELOW_MINIMUM, "qTp below minimum required");
          });
          it("THEN TC and AC are returned", async function () {
            assertPrec(prevTCBalance, await mocFunctions.tcBalanceOf(alice));
            assertACResult(prevACBalance, await mocFunctions.acBalanceOf(alice));
          });
        });
      });
    });
  });
};

export { swapTCforTPQueueBehavior };
