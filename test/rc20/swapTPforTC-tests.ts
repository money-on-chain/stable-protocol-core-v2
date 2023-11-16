import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import hre, { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { MocCARC20, MocQueue } from "../../typechain";
import { mocFunctionsRC20Deferred } from "../helpers/mocFunctionsRC20Deferred";
import { swapTPforTCBehavior } from "../behaviors/swapTPforTC.behavior";
import { Balance, ERROR_SELECTOR, OperId, OperType, ethersGetBalance, pEth, tpParams } from "../helpers/utils";
import { assertPrec } from "../helpers/assertHelper";
import { getNetworkDeployParams } from "../../scripts/utils";
import { fixtureDeployedMocRC20 } from "./fixture";

describe("Feature: MocCARC20 swap TP for TC", function () {
  describe("GIVEN a MocCARC20 implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
    });
    swapTPforTCBehavior();
  });
  describe("GIVEN a MocCARC20 implementation deployed behind MocQueue", function () {
    let mocImpl: MocCARC20;
    let mocFunctions: any;
    let mocQueue: MocQueue;
    let operId: OperId;
    let alice: Address;
    let executor: Address;
    const TP_0 = 0;
    const { execFeeParams } = getNetworkDeployParams(hre).queueParams;
    beforeEach(async function () {
      ({ alice, deployer: executor } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20Deferred(mocContracts);
      ({ mocImpl, mocQueue } = mocContracts);
    });
    describe("GIVEN Alice has 20 TP", function () {
      let queueTx: ContractTransaction;
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 100 });
        await mocFunctions.mintTP({ from: alice, qTP: 20 });
      });
      describe("WHEN she registers an Operation to swap 12 TP for TC paying max 10 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          queueTx = await mocFunctions.swapTPforTC({ from: alice, qTP: 12, qACmax: 10, execute: false });
        });
        it("THEN an operation queued event is emitted", async function () {
          await expect(queueTx)
            .to.emit(mocQueue, "OperationQueued")
            .withArgs(mocImpl.address, operId, OperType.swapTPforTC);
        });
        it("THEN Alice TP balance decreases by 12, as her funds are locked", async function () {
          assertPrec(await mocFunctions.tpBalanceOf(TP_0, alice), 8);
        });
        it("THEN Bucket balance increases by 12, as the funds are now locked there", async function () {
          assertPrec(await mocFunctions.tpBalanceOf(TP_0, mocImpl.address), 12);
        });
        describe("WHEN the operation is executed", function () {
          let executorBalanceBefore: Balance;
          beforeEach(async function () {
            executorBalanceBefore = await ethersGetBalance(executor);
            await mocFunctions.executeQueue();
          });
          it("THEN Alice TP balance doesn't change", async function () {
            assertPrec(await mocFunctions.tpBalanceOf(TP_0, alice), 8);
          });
          it("THEN Bucket TP balance is back to zero as tokes were burned", async function () {
            assertPrec(await mocFunctions.tpBalanceOf(TP_0, mocImpl.address), 0);
          });
          it("THEN queue executor receives the corresponding execution fees", async function () {
            const mocQueueBalance = await ethersGetBalance(mocQueue.address);
            await expect(mocQueueBalance).to.be.equal(0);
            const executorBalanceAfter = await ethersGetBalance(executor);
            await expect(executorBalanceAfter).to.be.equal(execFeeParams.swapTPforTCExecFee.add(executorBalanceBefore));
          });
        });
        describe("AND Pegged Token has been revaluated leaving the protocol below coverage", function () {
          // this test is to check that tx doesn't fail because underflow doing totalACAvailable - lckAC
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, "0.00000001");
          });
          describe("AND execution is evaluated", function () {
            let execTx: ContractTransaction;
            let prevTPBalance: Balance;
            let prevACBalance: Balance;
            beforeEach(async function () {
              prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
              prevACBalance = await mocFunctions.acBalanceOf(alice);
              execTx = await mocFunctions.executeQueue();
            });
            it("THEN Operations fails with Low Coverage, and Operation Error event is emitted", async function () {
              await expect(execTx)
                .to.emit(mocQueue, "OperationError")
                .withArgs(operId, ERROR_SELECTOR.LOW_COVERAGE, "Low coverage");
            });
            it("THEN TP and AC are returned", async function () {
              assertPrec(prevTPBalance.add(pEth(12)), await mocFunctions.tpBalanceOf(TP_0, alice));
              assertPrec(prevACBalance.add(pEth(10)), await mocFunctions.acBalanceOf(alice));
            });
          });
        });
      });
      describe("WHEN she registers an Operation to swap 12 TP with only 0.0001 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          queueTx = await mocFunctions.swapTPforTC({ from: alice, qTP: 12, qACmax: 0.0001, execute: false });
        });
        describe("AND execution is evaluated", function () {
          let execTx: ContractTransaction;
          let prevTPBalance: Balance;
          let prevACBalance: Balance;
          beforeEach(async function () {
            prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
            prevACBalance = await mocFunctions.acBalanceOf(alice);
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with Insufficient qac sent, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.INSUFFICIENT_QAC_SENT, "Insufficient qac sent");
          });
          it("THEN TP and AC are returned", async function () {
            assertPrec(prevTPBalance.add(pEth(12)), await mocFunctions.tpBalanceOf(TP_0, alice));
            assertPrec(prevACBalance.add(pEth(0.0001)), await mocFunctions.acBalanceOf(alice));
          });
        });
      });
      describe("WHEN she registers an Operation to swap 1 TP expecting at least 10000 TCs", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          queueTx = await mocFunctions.swapTPforTC({ from: alice, qTP: 1, qTCmin: 10000, execute: false });
        });
        describe("AND execution is evaluated", function () {
          let execTx: ContractTransaction;
          let prevTPBalance: Balance;
          let prevACBalance: Balance;
          beforeEach(async function () {
            prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
            prevACBalance = await mocFunctions.acBalanceOf(alice);
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with qTC below minimum required, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.QTC_BELOW_MINIMUM, "qTc below minimum required");
          });
          it("THEN TP and AC are returned", async function () {
            assertPrec(prevTPBalance.add(pEth(1)), await mocFunctions.tpBalanceOf(TP_0, alice));
            assertPrec(prevACBalance.add(pEth(10)), await mocFunctions.acBalanceOf(alice));
          });
        });
      });
    });
  });
});
