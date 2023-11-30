import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import hre, { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { MocCARC20Deferred, MocQueue } from "../../../typechain";
import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { redeemTPBehavior } from "../../behaviors/redeemTP.behavior";
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
import { assertPrec } from "../../helpers/assertHelper";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocCARC20Deferred redeem TP", function () {
  describe("GIVEN a MocCARC20Deferred implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
    });
    redeemTPBehavior();
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
    describe("GIVEN there are 100 TC and Alice has 20 TP", function () {
      let queueTx: ContractTransaction;
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: bob, qTC: 100 });
        await mocFunctions.mintTP({ from: alice, qTP: 20 });
      });

      describe("WHEN alice registers a redeems 20 TP Operation, expecting at least 21 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          await mocFunctions.redeemTP({ from: alice, qTP: 20, qACmin: 21, execute: false });
        });
        describe("AND execution is evaluated", function () {
          let execTx: ContractTransaction;
          let prevTPBalance: Balance;
          beforeEach(async function () {
            prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with qAC below min expected, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.QAC_BELOW_MINIMUM, "qAC below minimum required");
          });
          it("THEN TP is returned", async function () {
            assertPrec(prevTPBalance.add(pEth(20)), await mocFunctions.tpBalanceOf(TP_0, alice));
          });
        });
      });
      describe("AND Pegged Token revaluates", function () {
        beforeEach(async function () {
          await mocFunctions.mintTP({ from: bob, qTP: 20000 });
          await mocFunctions.pokePrice(TP_0, "0.1");
        });
        describe("WHEN Alice registers a redeem Operation for her TPs", function () {
          beforeEach(async function () {
            operId = await mocQueue.operIdCount();
            await mocFunctions.redeemTP({ from: alice, qTP: 20, execute: false });
          });
          describe("AND execution is evaluated", function () {
            let execTx: ContractTransaction;
            let prevTPBalance: Balance;
            beforeEach(async function () {
              prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
              execTx = await mocFunctions.executeQueue();
            });
            it("THEN Operations fails with LowCoverage, and Operation Error event is emitted", async function () {
              await expect(execTx)
                .to.emit(mocQueue, "OperationError")
                .withArgs(operId, ERROR_SELECTOR.LOW_COVERAGE, "Low coverage");
            });
            it("THEN TP is returned", async function () {
              assertPrec(prevTPBalance.add(pEth(20)), await mocFunctions.tpBalanceOf(TP_0, alice));
            });
          });
        });
      });

      describe("WHEN she registers an Operation to redeems 12 TP", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          queueTx = await mocFunctions.redeemTP({ from: alice, qTP: 12, execute: false });
        });
        it("THEN an operation queued event is emitted", async function () {
          await expect(queueTx)
            .to.emit(mocQueue, "OperationQueued")
            .withArgs(mocImpl.address, operId, OperType.redeemTP);
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
            await expect(executorBalanceAfter).to.be.equal(execFeeParams.tpRedeemExecFee.add(executorBalanceBefore));
          });
        });
      });
    });
  });
});
