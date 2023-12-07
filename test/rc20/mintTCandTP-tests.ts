import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import hre, { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { MocCARC20, MocQueue } from "../../typechain";
import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { mintTCandTPBehavior } from "../behaviors/mintTCandTP.behavior";
import { Balance, ERROR_SELECTOR, OperId, OperType, ethersGetBalance, pEth, tpParams } from "../helpers/utils";
import { assertPrec } from "../helpers/assertHelper";
import { getNetworkDeployParams } from "../../scripts/utils";
import { fixtureDeployedMocRC20 } from "./fixture";

describe("Feature: MocCARC20 mint TC and TP", function () {
  describe("GIVEN a MocCARC20 implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    mintTCandTPBehavior();
  });
  describe("GIVEN a MocCARC20 implementation deployed behind MocQueue", function () {
    let mocImpl: MocCARC20;
    let mocFunctions: any;
    let mocQueue: MocQueue;
    let operId: OperId;
    let deployer: Address;
    let alice: Address;
    let bob: Address;
    const TP_0 = 0;
    const { execFeeParams } = getNetworkDeployParams(hre).queueParams;
    beforeEach(async function () {
      ({ alice, bob, deployer } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20(mocContracts);
      ({ mocImpl, mocQueue } = mocContracts);
    });
    describe("WHEN Alice registers a mint 10 TC and 100 TP operation, sending only 1 AC", function () {
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        await mocFunctions.mintTCandTP({ from: alice, qTC: 10, qTP: 100, qACmax: 1, execute: false });
      });
      describe("AND execution is evaluated", function () {
        let execTx: ContractTransaction;
        let prevACBalance: Balance;
        beforeEach(async function () {
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          execTx = await mocFunctions.executeQueue();
        });
        it("THEN Operations fails with InsufficientQacSent, and Operation Error event is emitted", async function () {
          await expect(execTx)
            .to.emit(mocQueue, "OperationError")
            .withArgs(operId, ERROR_SELECTOR.INSUFFICIENT_QAC_SENT, "Insufficient qac sent");
        });
        it("THEN AC is returned", async function () {
          assertPrec(await mocImpl.qACLockedInPending(), 0);
          assertPrec(prevACBalance.add(pEth(1)), await mocFunctions.acBalanceOf(alice));
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
          await expect(mocQueueBalance).to.be.equal(0);
          const executorBalanceAfter = await ethersGetBalance(deployer);
          await expect(executorBalanceAfter).to.be.equal(execFeeParams.mintTCandTPExecFee.add(executorBalanceBefore));
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
          await mocFunctions.mintTCandTP({ from: alice, qTC: 10, qTP: 100, qACmax: 100, execute: false });
        });
        describe("AND Collateral Asset relation with Pegged Token price falls leaving the system below coverage", function () {
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, "0.01");
          });
          describe("AND execution is evaluated", function () {
            let execTx: ContractTransaction;
            let prevACBalance: Balance;
            beforeEach(async function () {
              prevACBalance = await mocFunctions.acBalanceOf(alice);
              execTx = await mocFunctions.executeQueue();
            });
            it("THEN Operations fails with Low coverage, and Operation Error event is emitted", async function () {
              await expect(execTx)
                .to.emit(mocQueue, "OperationError")
                .withArgs(operId, ERROR_SELECTOR.LOW_COVERAGE, "Low coverage");
            });
            it("THEN AC is returned", async function () {
              assertPrec(await mocImpl.qACLockedInPending(), 0);
              assertPrec(prevACBalance.add(pEth(100)), await mocFunctions.acBalanceOf(alice));
            });
          });
        });
      });
    });
  });
});
