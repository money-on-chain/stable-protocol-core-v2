import hre, { getNamedAccounts, ethers } from "hardhat";
import { ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { assertPrec } from "../../helpers/assertHelper";
import {
  Balance,
  CONSTANTS,
  ERRORS,
  pEth,
  getNetworkDeployParams,
  ERROR_SELECTOR,
  ethersGetBalance,
  OperId,
  OperType,
} from "../../helpers/utils";
import { MocCACoinbase, MocCARC20, MocQueue } from "../../../typechain";

const mintTCQueueBehavior = function () {
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let mocQueue: MocQueue;
  let operId: OperId;
  let deployer: Address;
  let alice: Address;
  let assertACResult: any;
  let execTx: ContractTransaction;
  let prevACBalance: Balance;
  const TP_0 = 0;
  const {
    execFeeParams: { tcMintExecFee },
  } = getNetworkDeployParams(hre).queueParams;
  describe("Feature: mint Collateral Token", function () {
    beforeEach(async function () {
      mocFunctions = this.mocFunctions;
      ({ mocImpl, mocQueue } = this.mocContracts);
      ({ deployer, alice } = await getNamedAccounts());
      assertACResult = mocFunctions.assertACResult(-tcMintExecFee);
    });
    describe("WHEN an user registers a mint 10 TC operation, sending 100 AC", function () {
      let queueTx: ContractTransaction;
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        queueTx = await mocFunctions.mintTC({ from: alice, qTC: 10, qACmax: 100, execute: false });
      });
      it("THEN nACcb is 0 AC", async function () {
        assertPrec(await mocImpl.nACcb(), 0);
      });
      it("THEN AC balance locked is 100 AC", async function () {
        assertPrec(await mocImpl.qACLockedInPending(), 100);
      });
      it("THEN an operation queued event is emitted", async function () {
        await expect(queueTx).to.emit(mocQueue, "OperationQueued").withArgs(mocImpl.address, operId, OperType.mintTC);
      });
      describe("AND refreshACBalance is called", function () {
        beforeEach(async function () {
          await mocFunctions.refreshACBalance();
        });
        it("THEN nACcb is still 0 AC", async function () {
          assertPrec(await mocImpl.nACcb(), 0);
        });
        it("THEN AC balance locked is still 100 AC", async function () {
          assertPrec(await mocImpl.qACLockedInPending(), 100);
        });
      });
      describe("AND operation is executed", function () {
        let executorBalanceBefore: Balance;
        beforeEach(async function () {
          executorBalanceBefore = await ethersGetBalance(deployer);
          await mocFunctions.executeQueue();
        });
        it("THEN nACcb is 10 AC", async function () {
          assertPrec(await mocImpl.nACcb(), 10);
        });
        it("THEN AC balance locked is 0 AC", async function () {
          assertPrec(await mocImpl.qACLockedInPending(), 0);
        });
        it("THEN queue executor receives the corresponding execution fees", async function () {
          const mocQueueBalance = await ethersGetBalance(mocQueue.address);
          expect(mocQueueBalance).to.be.equal(0);
          const executorBalanceAfter = await ethersGetBalance(deployer);
          expect(executorBalanceAfter).to.be.equal(tcMintExecFee.add(executorBalanceBefore));
        });
      });
    });
    describe("WHEN an user registers a mint 10 TC operation, sending only 10 AC", function () {
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        prevACBalance = await mocFunctions.acBalanceOf(alice);
        await mocFunctions.mintTC({ from: alice, qTC: 10, qACmax: 10, execute: false });
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
    describe("GIVEN 3000 TC and 100 TP are minted", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: deployer, qTC: 3000 });
        await mocFunctions.mintTP({ from: deployer, qTP: 100 });
      });
      describe("WHEN alice registers mint 1 wei TC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          await mocFunctions.mintTC({ from: alice, qTC: 1, qACmax: pEth(1), applyPrecision: false, execute: false });
        });
        describe("AND Collateral Asset relation with Pegged Token price falls to 1 making TC price falls too", function () {
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, 1);
          });
          describe("AND execution is evaluated", function () {
            beforeEach(async function () {
              execTx = await mocFunctions.executeQueue();
            });
            it("THEN Operations fails with Unhandled Error", async function () {
              await expect(execTx)
                .to.emit(mocQueue, "UnhandledError")
                .withArgs(operId, ERROR_SELECTOR.QAC_NEEDED_MUST_BE_GREATER_ZERO);
            });
            it("THEN AC is returned", async function () {
              assertPrec(await mocImpl.qACLockedInPending(), 0);
              assertACResult(prevACBalance, await mocFunctions.acBalanceOf(alice));
            });
          });
        });
      });
      describe("WHEN Alice registers a mint 10 TC operation, sending only 10.5 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          await mocFunctions.mintTC({ from: alice, qTC: 10, qACmax: 10.5, execute: false });
        });
        describe("AND Collateral Asset relation with Pegged Token price falls to 1/15.5", function () {
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, "0.06451");
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
    describe("WHEN alice registers a mint 10 TC to the zero address", function () {
      const functionSelector = ethers.utils.id("Error(string)").slice(0, 10);
      const encodedMintToZeroMessage = ethers.utils.defaultAbiCoder.encode(["string"], [ERRORS.MINT_TO_ZERO_ADDRESS]);
      // Concatenate function selector and encoded message
      const encodedMintToZeroAddressError = functionSelector + encodedMintToZeroMessage.slice(2);

      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        await mocFunctions.mintTC({ from: alice, to: CONSTANTS.ZERO_ADDRESS, qTC: 10, qACmax: 10.5, execute: false });
      });
      describe("AND execution is evaluated", function () {
        beforeEach(async function () {
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          execTx = await mocFunctions.executeQueue();
        });
        it("THEN Operations fails with Unhandled Error", async function () {
          await expect(execTx).to.emit(mocQueue, "UnhandledError").withArgs(operId, encodedMintToZeroAddressError);
        });
        it("THEN AC is returned", async function () {
          assertPrec(await mocImpl.qACLockedInPending(), 0);
          assertPrec(prevACBalance.add(pEth(10.5)), await mocFunctions.acBalanceOf(alice));
        });
      });
    });
  });
};

export { mintTCQueueBehavior };
