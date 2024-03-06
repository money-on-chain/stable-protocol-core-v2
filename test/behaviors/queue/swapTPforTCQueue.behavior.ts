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
  ERRORS,
  noVendor,
} from "../../helpers/utils";
import { MocCACoinbase, MocCARC20, MocQueue, MocRC20 } from "../../../typechain";

const swapTPforTCQueueBehavior = function () {
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let tps: MocRC20[];
  let mocQueue: MocQueue;
  let operId: OperId;
  let executor: Address;
  let alice: Address;
  let assertACResult: any;
  let execTx: ContractTransaction;
  let prevTPBalance: Balance;
  let prevACBalance: Balance;
  const TP_0 = 0;
  const {
    execFeeParams: { swapTPforTCExecFee },
  } = getNetworkDeployParams(hre).queueParams;
  describe("Feature: swap Pegged Token for Collateral Token", function () {
    beforeEach(async function () {
      mocFunctions = this.mocFunctions;
      ({ mocImpl, mocQueue, mocPeggedTokens: tps } = this.mocContracts);
      ({ alice, deployer: executor } = await getNamedAccounts());
      assertACResult = mocFunctions.assertACResult(-swapTPforTCExecFee);
    });
    describe("GIVEN Alice has 20 TP", function () {
      let queueTx: ContractTransaction;
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 100 });
        await mocFunctions.mintTP({ from: alice, qTP: 20 });
      });
      describe("WHEN an user tries to execute a swap TP for TC operation without the queue", function () {
        it("THEN tx reverts only MocQueue can execute operations", async function () {
          const swapTPforTCParams = {
            tp: tps[0].address,
            qTP: 1,
            qTCmin: 1,
            qACmax: 1,
            sender: alice,
            recipient: alice,
            vendor: noVendor,
          };
          await expect(mocImpl.execSwapTPforTC(swapTPforTCParams)).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.ONLY_QUEUE,
          );
        });
      });
      describe("WHEN she registers an Operation to swap 12 TP for TC paying max 10 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          prevACBalance = await mocFunctions.acBalanceOf(alice);
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
            expect(mocQueueBalance).to.be.equal(0);
            const executorBalanceAfter = await ethersGetBalance(executor);
            expect(executorBalanceAfter).to.be.equal(swapTPforTCExecFee.add(executorBalanceBefore));
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
            it("THEN TP and AC are returned", async function () {
              assertPrec(prevTPBalance, await mocFunctions.tpBalanceOf(TP_0, alice));
              assertACResult(prevACBalance, await mocFunctions.acBalanceOf(alice));
            });
          });
        });
      });
      describe("WHEN she registers an Operation to swap 12 TP with only 0.0001 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          queueTx = await mocFunctions.swapTPforTC({ from: alice, qTP: 12, qACmax: 0.0001, execute: false });
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
          it("THEN TP and AC are returned", async function () {
            assertPrec(prevTPBalance, await mocFunctions.tpBalanceOf(TP_0, alice));
            assertACResult(prevACBalance, await mocFunctions.acBalanceOf(alice));
          });
        });
      });
      describe("WHEN she registers an Operation to swap 1 TP expecting at least 10000 TCs", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          queueTx = await mocFunctions.swapTPforTC({ from: alice, qTP: 1, qTCmin: 10000, execute: false });
        });
        describe("AND execution is evaluated", function () {
          beforeEach(async function () {
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with qTC below minimum required, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.QTC_BELOW_MINIMUM, "qTc below minimum required");
          });
          it("THEN TP and AC are returned", async function () {
            assertPrec(prevTPBalance, await mocFunctions.tpBalanceOf(TP_0, alice));
            assertACResult(prevACBalance, await mocFunctions.acBalanceOf(alice));
          });
        });
      });
    });
  });
};

export { swapTPforTCQueueBehavior };
