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

const mintTCandTPQueueBehavior = function () {
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let mocQueue: MocQueue;
  let operId: OperId;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  let assertACResult: any;
  let execTx: ContractTransaction;
  let prevACBalance: Balance;
  const TP_0 = 0;
  const {
    execFeeParams: { mintTCandTPExecFee },
  } = getNetworkDeployParams(hre).queueParams;
  describe("Feature: joint Mint TC and TP operation", function () {
    beforeEach(async function () {
      mocFunctions = this.mocFunctions;
      ({ mocImpl, mocQueue } = this.mocContracts);
      ({ alice, bob, deployer } = await getNamedAccounts());
      assertACResult = mocFunctions.assertACResult(-mintTCandTPExecFee);
    });
    describe("WHEN Alice registers a mint 10 TC and 100 TP operation, sending only 1 AC", function () {
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        prevACBalance = await mocFunctions.acBalanceOf(alice);
        await mocFunctions.mintTCandTP({ from: alice, qTC: 10, qTP: 100, qACmax: 1, execute: false });
      });
      describe("AND execution is evaluated", function () {
        beforeEach(async function () {
          execTx = await mocFunctions.executeQueue();
        });
        it("THEN Operations fails with InsufficientQacSent, and Operation Error event is emitted", async function () {
          await expect(execTx)
            .to.emit(mocQueue, "OperationError")
            .withArgs(operId, ERROR_SELECTOR.INSUFFICIENT_QAC_SENT, "Insufficient qac sent");
        });
        it("THEN AC is returned", async function () {
          assertPrec(await mocImpl.qACLockedInPending(), 0);
          assertACResult(prevACBalance, await mocFunctions.acBalanceOf(alice));
        });
      });
    });

    describe("WHEN Alice registers a mint 10 TC and 100 TP operation, sending 100 AC", function () {
      let queueTx: ContractTransaction;
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        queueTx = await mocFunctions.mintTCandTP({ from: alice, qTC: 10, qTP: 100, qACmax: 100, execute: false });
      });
      it("THEN nACcb is 0 AC", async function () {
        assertPrec(await mocImpl.nACcb(), 0);
      });
      it("THEN AC balance locked is 100 AC", async function () {
        assertPrec(await mocImpl.qACLockedInPending(), 100);
      });
      it("THEN an operation queued event is emitted", async function () {
        await expect(queueTx)
          .to.emit(mocQueue, "OperationQueued")
          .withArgs(mocImpl.address, operId, OperType.mintTCandTP);
      });
      describe("AND queue execution is evaluated", function () {
        let executorBalanceBefore: Balance;
        beforeEach(async function () {
          executorBalanceBefore = await ethersGetBalance(deployer);
          await mocFunctions.executeQueue();
        });
        it("THEN AC balance locked is 0 AC", async function () {
          assertPrec(await mocImpl.qACLockedInPending(), 0);
        });
        it("THEN queue executor receives the corresponding execution fees", async function () {
          const mocQueueBalance = await ethersGetBalance(mocQueue.address);
          expect(mocQueueBalance).to.be.equal(0);
          const executorBalanceAfter = await ethersGetBalance(deployer);
          expect(executorBalanceAfter).to.be.equal(mintTCandTPExecFee.add(executorBalanceBefore));
        });
      });
    });
    describe("AND there are 10 TC and 100 TP on the protocol", function () {
      beforeEach(async function () {
        await mocFunctions.mintTCandTP({ from: bob, qTC: 10, qTP: 100, qACmax: 100 });
      });
      describe("WHEN Alice registers a mint 10 TC and 100 TP operation, sending 100 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          await mocFunctions.mintTCandTP({ from: alice, qTC: 10, qTP: 100, qACmax: 100, execute: false });
        });
        describe("AND Collateral Asset relation with Pegged Token price falls leaving the system below coverage", function () {
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, "0.01");
          });
          describe("AND execution is evaluated", function () {
            beforeEach(async function () {
              execTx = await mocFunctions.executeQueue();
            });
            it("THEN Operations fails with Low coverage, and Operation Error event is emitted", async function () {
              await expect(execTx)
                .to.emit(mocQueue, "OperationError")
                .withArgs(operId, ERROR_SELECTOR.LOW_COVERAGE, "Low coverage");
            });
            it("THEN AC is returned", async function () {
              assertPrec(await mocImpl.qACLockedInPending(), 0);
              assertACResult(prevACBalance, await mocFunctions.acBalanceOf(alice));
            });
          });
        });
      });
    });
  });
};

export { mintTCandTPQueueBehavior };
