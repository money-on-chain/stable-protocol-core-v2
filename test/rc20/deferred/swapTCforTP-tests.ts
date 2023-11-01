import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import hre, { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { MocCARC20Deferred, MocQueue } from "../../../typechain";
import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { swapTCforTPBehavior } from "../../behaviors/swapTCforTP.behavior";
import { Balance, ERROR_SELECTOR, OperId, OperType, ethersGetBalance, pEth, tpParams } from "../../helpers/utils";
import { assertPrec } from "../../helpers/assertHelper";
import { getNetworkDeployParams } from "../../../scripts/utils";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocCARC20Deferred swap TC for TP", function () {
  describe("GIVEN a MocCARC20Deferred implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
    });
    swapTCforTPBehavior();
  });
  describe("GIVEN a MocCARC20Deferred implementation deployed behind MocQueue", function () {
    let mocImpl: MocCARC20Deferred;
    let mocFunctions: any;
    let mocQueue: MocQueue;
    let operId: OperId;
    let alice: Address;
    let bob: Address;
    let executor: Address;
    const TP_0 = 0;
    const { execFeeParams } = getNetworkDeployParams(hre).queueParams;
    beforeEach(async function () {
      ({ alice, bob, deployer: executor } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20Deferred(mocContracts);
      ({ mocImpl, mocQueue } = mocContracts);
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
            await expect(mocQueueBalance).to.be.equal(0);
            const executorBalanceAfter = await ethersGetBalance(executor);
            await expect(executorBalanceAfter).to.be.equal(execFeeParams.swapTCforTPExecFee.add(executorBalanceBefore));
          });
        });
        describe("AND Pegged Token has been revaluated leaving the protocol below coverage", function () {
          // this test is to check that tx doesn't fail because underflow doing totalACAvailable - lckAC
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, "0.00000001");
          });
          describe("AND execution is evaluated", function () {
            let execTx: ContractTransaction;
            let prevTCBalance: Balance;
            let prevACBalance: Balance;
            beforeEach(async function () {
              prevTCBalance = await mocFunctions.tcBalanceOf(alice);
              prevACBalance = await mocFunctions.acBalanceOf(alice);
              execTx = await mocFunctions.executeQueue();
            });
            it("THEN Operations fails with Low Coverage, and Operation Error event is emitted", async function () {
              await expect(execTx)
                .to.emit(mocQueue, "OperationError")
                .withArgs(operId, ERROR_SELECTOR.LOW_COVERAGE, "Low coverage");
            });
            it("THEN TC and AC are returned", async function () {
              assertPrec(prevTCBalance.add(pEth(12)), await mocFunctions.tcBalanceOf(alice));
              assertPrec(prevACBalance.add(pEth(10)), await mocFunctions.acBalanceOf(alice));
            });
          });
        });
      });
      describe("WHEN she registers an Operation to swap 12 TC with only 0.01 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          queueTx = await mocFunctions.swapTCforTP({ from: alice, qTC: 12, qACmax: 0.01, execute: false });
        });
        describe("AND execution is evaluated", function () {
          let execTx: ContractTransaction;
          let prevTCBalance: Balance;
          let prevACBalance: Balance;
          beforeEach(async function () {
            prevTCBalance = await mocFunctions.tcBalanceOf(alice);
            prevACBalance = await mocFunctions.acBalanceOf(alice);
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with Insufficient qac sent, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.INSUFFICIENT_QAC_SENT, "Insufficient qac sent");
          });
          it("THEN TC and AC are returned", async function () {
            assertPrec(prevTCBalance.add(pEth(12)), await mocFunctions.tcBalanceOf(alice));
            assertPrec(prevACBalance.add(pEth(0.01)), await mocFunctions.acBalanceOf(alice));
          });
        });
      });
      describe("WHEN she registers an Operation to swap 1 TC expecting at least 10000 TPs", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          queueTx = await mocFunctions.swapTCforTP({ from: alice, qTC: 1, qTPmin: 10000, execute: false });
        });
        describe("AND execution is evaluated", function () {
          let execTx: ContractTransaction;
          let prevTCBalance: Balance;
          let prevACBalance: Balance;
          beforeEach(async function () {
            prevTCBalance = await mocFunctions.tcBalanceOf(alice);
            prevACBalance = await mocFunctions.acBalanceOf(alice);
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with qTP below minimum required, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.QTP_BELOW_MINIMUM, "qTp below minimum required");
          });
          it("THEN TC and AC are returned", async function () {
            assertPrec(prevTCBalance.add(pEth(1)), await mocFunctions.tcBalanceOf(alice));
            assertPrec(prevACBalance.add(pEth(10)), await mocFunctions.acBalanceOf(alice));
          });
        });
      });
    });
  });
});
