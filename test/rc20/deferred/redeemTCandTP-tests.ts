import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import hre, { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { MocCARC20Deferred, MocQueue } from "../../../typechain";
import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { redeemTCandTPBehavior } from "../../behaviors/redeemTCandTP.behavior";
import { Balance, ERROR_SELECTOR, OperId, OperType, ethersGetBalance, pEth, tpParams } from "../../helpers/utils";
import { assertPrec } from "../../helpers/assertHelper";
import { getNetworkDeployParams } from "../../../scripts/utils";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocCARC20Deferred redeem TC and TP", function () {
  describe("GIVEN a MocCARC20Deferred implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
    });
    redeemTCandTPBehavior();
  });

  describe("GIVEN a MocCARC20Deferred implementation deployed behind MocQueue", function () {
    let mocImpl: MocCARC20Deferred;
    let mocFunctions: any;
    let mocQueue: MocQueue;
    let operId: OperId;
    let alice: Address;
    let executor: Address;
    const TP_0 = 0;
    const { execFeeParams } = getNetworkDeployParams(hre).queueParams;
    beforeEach(async function () {
      ({ alice, deployer: executor } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20Deferred(mocContracts);
      ({ mocImpl, mocQueue } = mocContracts);
    });

    describe("GIVEN alice has 3000 TC, 23500 TP 0", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 3000 });
        await mocFunctions.mintTP({ from: alice, qTP: 23500 });
      });
      describe("WHEN she registers a joint redeem Operation of 100 TC and max 800 TP", function () {
        let queueTx: ContractTransaction;
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          queueTx = await mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 800, execute: false });
        });
        it("THEN an operation queued event is emitted", async function () {
          await expect(queueTx)
            .to.emit(mocQueue, "OperationQueued")
            .withArgs(mocImpl.address, operId, OperType.redeemTCandTP);
        });
        it("THEN Alice both TP and TC balances decreases, as her funds are locked", async function () {
          assertPrec(await mocFunctions.tcBalanceOf(alice), 3000 - 100);
          assertPrec(await mocFunctions.tpBalanceOf(TP_0, alice), 23500 - 800);
        });
        it("THEN Bucket both TP and TC balances increases, as the funds are now locked there", async function () {
          assertPrec(await mocFunctions.tcBalanceOf(mocImpl.address), 100);
          assertPrec(await mocFunctions.tpBalanceOf(TP_0, mocImpl.address), 800);
        });
        describe("WHEN the operation is executed", function () {
          let executorBalanceBefore: Balance;
          beforeEach(async function () {
            executorBalanceBefore = await ethersGetBalance(executor);
            await mocFunctions.executeQueue();
          });
          it("THEN Alice TC balance doesn't change as all is redeemed", async function () {
            assertPrec(await mocFunctions.tcBalanceOf(alice), 3000 - 100);
          });
          it("THEN Alice received the TP change, as she only redeemed 783.33 TP", async function () {
            assertPrec(await mocFunctions.tpBalanceOf(TP_0, alice), "22716.666666666666666667");
          });
          it("THEN Bucket balances are back to zero as tokes were burned or returned", async function () {
            assertPrec(await mocFunctions.tcBalanceOf(mocImpl.address), 0);
            assertPrec(await mocFunctions.tpBalanceOf(TP_0, mocImpl.address), 0);
          });
          it("THEN queue executor receives the corresponding execution fees", async function () {
            const mocQueueBalance = await ethersGetBalance(mocQueue.address);
            await expect(mocQueueBalance).to.be.equal(0);
            const executorBalanceAfter = await ethersGetBalance(executor);
            await expect(executorBalanceAfter).to.be.equal(
              execFeeParams.redeemTCandTPExecFee.add(executorBalanceBefore),
            );
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
            let prevTPBalance: Balance;
            beforeEach(async function () {
              prevTCBalance = await mocFunctions.tcBalanceOf(alice);
              prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
              execTx = await mocFunctions.executeQueue();
            });
            it("THEN Operations fails with Low Coverage, and Operation Error event is emitted", async function () {
              await expect(execTx)
                .to.emit(mocQueue, "OperationError")
                .withArgs(operId, ERROR_SELECTOR.LOW_COVERAGE, "Low coverage");
            });
            it("THEN TC and Tps are returned", async function () {
              assertPrec(prevTCBalance.add(pEth(100)), await mocFunctions.tcBalanceOf(alice));
              assertPrec(prevTPBalance.add(pEth(800)), await mocFunctions.tpBalanceOf(TP_0, alice));
            });
          });
        });
      });
      describe("WHEN she registers a joint redeem Operation of 100 TC and only max 80 TP", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          await mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 80, execute: false });
        });
        describe("AND execution is evaluated", function () {
          let execTx: ContractTransaction;
          let prevTCBalance: Balance;
          let prevTPBalance: Balance;
          beforeEach(async function () {
            prevTCBalance = await mocFunctions.tcBalanceOf(alice);
            prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with Insufficient qTP, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.INSUFFICIENT_QTP_SENT, "Insufficient tp sent");
          });
          it("THEN TC and Tps are returned", async function () {
            assertPrec(prevTCBalance.add(pEth(100)), await mocFunctions.tcBalanceOf(alice));
            assertPrec(prevTPBalance.add(pEth(80)), await mocFunctions.tpBalanceOf(TP_0, alice));
          });
        });
      });
      describe("WHEN she registers a joint redeem Operation of 10 TC and max 80 TP expecting at least 100 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          await mocFunctions.redeemTCandTP({ from: alice, qTC: 10, qTP: 80, qACmin: 100, execute: false });
        });
        describe("AND execution is evaluated", function () {
          let execTx: ContractTransaction;
          let prevTCBalance: Balance;
          let prevTPBalance: Balance;
          beforeEach(async function () {
            prevTCBalance = await mocFunctions.tcBalanceOf(alice);
            prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with Insufficient qTP, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.QAC_BELOW_MINIMUM, "qAC below minimum required");
          });
          it("THEN TC and Tps are returned", async function () {
            assertPrec(prevTCBalance.add(pEth(10)), await mocFunctions.tcBalanceOf(alice));
            assertPrec(prevTPBalance.add(pEth(80)), await mocFunctions.tpBalanceOf(TP_0, alice));
          });
        });
      });
    });
  });
});
