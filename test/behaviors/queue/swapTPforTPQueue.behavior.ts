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
  noVendor,
  ERRORS,
} from "../../helpers/utils";
import { MocCACoinbase, MocCARC20, MocQueue, MocRC20 } from "../../../typechain";

const swapTPforTPQueueBehavior = function () {
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let tps: MocRC20[];
  let mocQueue: MocQueue;
  let operId: OperId;
  let executor: Address;
  let alice: Address;
  let bob: Address;
  let assertACResult: any;
  let execTx: ContractTransaction;
  let prevTPBalance: Balance;
  let prevACBalance: Balance;
  const TP_0 = 0;
  const {
    execFeeParams: { swapTPforTPExecFee },
  } = getNetworkDeployParams(hre).queueParams;
  describe("Feature: swap Pegged Token for another Pegged Token", function () {
    beforeEach(async function () {
      mocFunctions = this.mocFunctions;
      ({ mocImpl, mocQueue, mocPeggedTokens: tps } = this.mocContracts);
      ({ alice, bob, deployer: executor } = await getNamedAccounts());
      assertACResult = mocFunctions.assertACResult(-swapTPforTPExecFee);
    });
    describe("GIVEN Alice has 20 TP", function () {
      let queueTx: ContractTransaction;
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: bob, qTC: 3000 });
        await mocFunctions.mintTP({ from: alice, qTP: 20 });
      });
      describe("WHEN an user tries to execute a swap TP for TP operation without the queue", function () {
        it("THEN tx reverts only MocQueue can execute operations", async function () {
          const swapTPforTPParams = {
            tpFrom: tps[0].address,
            tpTo: tps[0].address,
            qTP: 1,
            qTPmin: 1,
            qACmax: 1,
            sender: alice,
            recipient: alice,
            vendor: noVendor,
          };
          await expect(mocImpl.execSwapTPforTP(swapTPforTPParams)).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.ONLY_QUEUE,
          );
        });
      });
      describe("WHEN she registers an Operation to swap 12 TP0 for TP1", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          queueTx = await mocFunctions.swapTPforTP({ from: alice, qTP: 12, execute: false });
        });
        it("THEN an operation queued event is emitted", async function () {
          await expect(queueTx)
            .to.emit(mocQueue, "OperationQueued")
            .withArgs(mocImpl.address, operId, OperType.swapTPforTP);
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
            expect(executorBalanceAfter).to.be.equal(swapTPforTPExecFee.add(executorBalanceBefore));
          });
        });
      });
      describe("WHEN she registers an Operation to swap 12 TP0 for TP1 with only 0.0001 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          queueTx = await mocFunctions.swapTPforTP({ from: alice, qTP: 12, qACmax: 0.0001, execute: false });
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
      describe("WHEN she registers an Operation to swap 23500 TP0 expecting at least 526 TP1", function () {
        beforeEach(async function () {
          await mocFunctions.mintTP({ from: alice, qTP: 23480 });
          operId = await mocQueue.operIdCount();
          prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          queueTx = await mocFunctions.swapTPforTP({
            from: alice,
            qTP: 23500,
            qTPmin: 526,
            execute: false,
          });
        });
        describe("AND execution is evaluated", function () {
          beforeEach(async function () {
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with qTC below minimum required, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.QTP_BELOW_MINIMUM, "qTp below minimum required");
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

export { swapTPforTPQueueBehavior };
