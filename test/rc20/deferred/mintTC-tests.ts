import { expect } from "chai";
import hre, { getNamedAccounts, ethers } from "hardhat";
import { ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";
import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { mintTCBehavior } from "../../behaviors/mintTC.behavior";
import {
  Balance,
  CONSTANTS,
  ERRORS,
  ERROR_SELECTOR,
  OperId,
  OperType,
  ethersGetBalance,
  pEth,
  tpParams,
} from "../../helpers/utils";
import { MocCARC20Deferred, MocQueue } from "../../../typechain";
import { assertPrec } from "../../helpers/assertHelper";
import { getNetworkDeployParams } from "../../../scripts/utils";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocCARC20Deferred mint TC", function () {
  let mocFunctions: any;
  let deployer: Address;
  const { execFeeParams } = getNetworkDeployParams(hre).queueParams;

  describe("GIVEN a MocCARC20Deferred implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      ({ deployer } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
      this.mocFunctions = mocFunctions;
    });

    mintTCBehavior();

    describe("WHEN an user sends almost max uint256 amount of Asset to mint TC", function () {
      it("THEN tx reverts with panic code 0x11 overflow", async function () {
        const qACmax = CONSTANTS.MAX_BALANCE;
        const qTC = CONSTANTS.MAX_BALANCE;
        await expect(
          mocFunctions.mintTC({ from: deployer, qTC, qACmax, applyPrecision: false }),
        ).to.be.revertedWithPanic("0x11");
      });
    });
  });
  describe("GIVEN a MocCARC20Deferred implementation deployed behind MocQueue", function () {
    let mocImpl: MocCARC20Deferred;
    let mocQueue: MocQueue;
    let operId: OperId;
    let alice: Address;
    let executorBalanceBefore: Balance;
    const TP_0 = 0;
    beforeEach(async function () {
      ({ deployer, alice } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20Deferred(mocContracts);
      ({ mocImpl, mocQueue } = mocContracts);
    });

    describe("WHEN an user registers a mint 10 TC operation, sending 100 AC", function () {
      let queueTx: ContractTransaction;
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        queueTx = await mocFunctions.mintTC({ from: deployer, qTC: 10, qACmax: 100, execute: false });
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
          await mocImpl.refreshACBalance();
        });
        it("THEN nACcb is still 0 AC", async function () {
          assertPrec(await mocImpl.nACcb(), 0);
        });
        it("THEN AC balance locked is still 100 AC", async function () {
          assertPrec(await mocImpl.qACLockedInPending(), 100);
        });
      });
      describe("AND operation is executed", function () {
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
          await expect(mocQueueBalance).to.be.equal(0);
          const executorBalanceAfter = await ethersGetBalance(deployer);
          await expect(executorBalanceAfter).to.be.equal(execFeeParams.tcMintExecFee.add(executorBalanceBefore));
        });
      });
    });
    describe("WHEN an user registers a mint 10 TC operation, sending only 10 AC", function () {
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        await mocFunctions.mintTC({ from: deployer, qTC: 10, qACmax: 10, execute: false });
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
          assertPrec(prevACBalance.add(pEth(10)), await mocFunctions.acBalanceOf(deployer));
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
          await mocFunctions.mintTC({ from: alice, qTC: 1, qACmax: pEth(1), applyPrecision: false, execute: false });
        });
        describe("AND Collateral Asset relation with Pegged Token price falls to 1 making TC price falls too", function () {
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, 1);
          });
          describe("AND execution is evaluated", function () {
            let execTx: ContractTransaction;
            let prevACBalance: Balance;
            beforeEach(async function () {
              prevACBalance = await mocFunctions.acBalanceOf(alice);
              execTx = await mocFunctions.executeQueue();
            });
            it("THEN Operations fails with Unhandled Error", async function () {
              await expect(execTx)
                .to.emit(mocQueue, "UnhandledError")
                .withArgs(operId, ERROR_SELECTOR.QAC_NEEDED_MUST_BE_GREATER_ZERO);
            });
            it("THEN AC is returned", async function () {
              assertPrec(await mocImpl.qACLockedInPending(), 0);
              assertPrec(prevACBalance.add(pEth(1)), await mocFunctions.acBalanceOf(alice));
            });
          });
        });
      });
      describe("WHEN Alice registers a mint 10 TC operation, sending only 10.5 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          await mocFunctions.mintTC({ from: alice, qTC: 10, qACmax: 10.5, execute: false });
        });
        describe("AND Collateral Asset relation with Pegged Token price falls to 1/15.5", function () {
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, "0.06451");
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
              assertPrec(prevACBalance.add(pEth(10.5)), await mocFunctions.acBalanceOf(alice));
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
        let execTx: ContractTransaction;
        let prevACBalance: Balance;
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
});
