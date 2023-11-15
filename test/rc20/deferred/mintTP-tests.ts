import { expect } from "chai";
import hre, { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";
import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { mintTPBehavior } from "../../behaviors/mintTP.behavior";
import {
  Balance,
  ERROR_SELECTOR,
  OperId,
  OperType,
  ethersGetBalance,
  pEth,
  tpParams,
  getNetworkDeployParams,
} from "../../helpers/utils";
import { MocCARC20, MocQueue } from "../../../typechain";
import { assertPrec } from "../../helpers/assertHelper";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocCARC20 mint TP", function () {
  describe("GIVEN a MocCARC20 implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
    });
    mintTPBehavior();
  });

  describe("GIVEN a MocCARC20 implementation deployed behind MocQueue", function () {
    let mocImpl: MocCARC20;
    let mocFunctions: any;
    let mocQueue: MocQueue;
    let operId: OperId;
    let deployer: Address;
    let alice: Address;
    const TP_0 = 0;
    const { execFeeParams } = getNetworkDeployParams(hre).queueParams;

    beforeEach(async function () {
      ({ deployer, alice } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20Deferred(mocContracts);
      ({ mocImpl, mocQueue } = mocContracts);
    });
    describe("WHEN alice sends 100 Asset to mint 100 TP but there is not collateral in the protocol", function () {
      let execTx: ContractTransaction;
      let prevACBalance: Balance;
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        prevACBalance = await mocFunctions.acBalanceOf(alice);
        execTx = mocFunctions.mintTP({ from: alice, qTP: 100, qACmax: 100 });
      });
      it("THEN Operations fails as there is not enough TP to mint, and Operation Error event is emitted", async function () {
        await expect(execTx)
          .to.emit(mocQueue, "OperationError")
          .withArgs(operId, ERROR_SELECTOR.INSUFFICIENT_TP_TO_MINT, "Insufficient tp to mint");
      });
      it("THEN AC is returned", async function () {
        assertPrec(await mocImpl.qACLockedInPending(), 0);
        assertPrec(prevACBalance, await mocFunctions.acBalanceOf(alice));
      });
    });
    describe("WHEN an user sends 100 AC to put a mint 10 TP operation in the queue", function () {
      let queueTx: ContractTransaction;
      beforeEach(async function () {
        // add collateral to be able to mint TP
        await mocFunctions.mintTC({ from: deployer, qTC: 100 });
        await mocFunctions.mintTP({ from: alice, qTP: 100 });
        operId = await mocQueue.operIdCount();
        // Register a mintTP operation without executing it
        queueTx = await mocFunctions.mintTP({ from: deployer, qTP: 10, qACmax: 100, execute: false });
      });
      it("THEN AC balance locked is 100 AC", async function () {
        assertPrec(await mocImpl.qACLockedInPending(), 100);
      });
      it("THEN an operation queued event is emitted", async function () {
        await expect(queueTx).to.emit(mocQueue, "OperationQueued").withArgs(mocImpl.address, operId, OperType.mintTP);
      });
      describe("AND operation is executed", function () {
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
          await expect(executorBalanceAfter).to.be.equal(execFeeParams.tpMintExecFee.add(executorBalanceBefore));
        });
      });
      describe("AND Collateral Asset relation with Pegged Token price falls leaving the system below coverage", function () {
        beforeEach(async function () {
          await mocFunctions.pokePrice(TP_0, "0.01");
        });
        describe("AND execution is evaluated", function () {
          let execTx: ContractTransaction;
          let prevACBalance: Balance;
          beforeEach(async function () {
            prevACBalance = await mocFunctions.acBalanceOf(deployer);
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with Low coverage, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.LOW_COVERAGE, "Low coverage");
          });
          it("THEN AC is returned", async function () {
            assertPrec(await mocImpl.qACLockedInPending(), 0);
            assertPrec(prevACBalance.add(pEth(100)), await mocFunctions.acBalanceOf(deployer));
          });
        });
      });
    });
    describe("WHEN an user registers a mint 10 TP operation, sending only 0.01 AC", function () {
      beforeEach(async function () {
        // add collateral to be able to mint TP
        await mocFunctions.mintTC({ from: deployer, qTC: 100 });
        operId = await mocQueue.operIdCount();
        await mocFunctions.mintTP({ from: deployer, qTP: 10, qACmax: 0.01, execute: false });
      });
      describe("AND execution is evaluated", function () {
        let execTx: ContractTransaction;
        let prevACBalance: Balance;
        beforeEach(async function () {
          prevACBalance = await mocFunctions.acBalanceOf(deployer);
          execTx = await mocFunctions.executeQueue();
        });
        it("THEN Operations fails with InsufficientQacSent, and Operation Error event is emitted", async function () {
          await expect(execTx)
            .to.emit(mocQueue, "OperationError")
            .withArgs(operId, ERROR_SELECTOR.INSUFFICIENT_QAC_SENT, "Insufficient qac sent");
        });
        it("THEN AC is returned", async function () {
          assertPrec(await mocImpl.qACLockedInPending(), 0);
          assertPrec(prevACBalance.add(pEth(0.01)), await mocFunctions.acBalanceOf(deployer));
        });
      });
    });
  });
});
