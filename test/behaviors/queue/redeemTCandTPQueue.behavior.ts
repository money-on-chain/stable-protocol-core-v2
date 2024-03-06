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

const redeemTCandTPQueueBehavior = function () {
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let tps: MocRC20[];
  let mocQueue: MocQueue;
  let operId: OperId;
  let executor: Address;
  let alice: Address;
  let execTx: ContractTransaction;
  let prevTCBalance: Balance;
  let prevTPBalance: Balance;
  const TP_0 = 0;
  const {
    execFeeParams: { redeemTCandTPExecFee },
  } = getNetworkDeployParams(hre).queueParams;
  describe("Feature: joint Redeem TC and TP operation", function () {
    beforeEach(async function () {
      mocFunctions = this.mocFunctions;
      ({ mocImpl, mocQueue, mocPeggedTokens: tps } = this.mocContracts);
      ({ alice, deployer: executor } = await getNamedAccounts());
    });
    describe("GIVEN alice has 3000 TC, 23500 TP 0", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 3000 });
        await mocFunctions.mintTP({ from: alice, qTP: 23500 });
      });
      describe("WHEN an user tries to execute a redeem TC and TP operation without the queue", function () {
        it("THEN tx reverts only MocQueue can execute operations", async function () {
          const redeemTCandTPParams = {
            tp: tps[0].address,
            qTC: 1,
            qTP: 1,
            qACmin: 1,
            sender: alice,
            recipient: alice,
            vendor: noVendor,
          };
          await expect(mocImpl.execRedeemTCandTP(redeemTCandTPParams)).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.ONLY_QUEUE,
          );
        });
      });
      describe("WHEN she registers a joint redeem Operation of 100 TC and max 800 TP", function () {
        let queueTx: ContractTransaction;
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevTCBalance = await mocFunctions.tcBalanceOf(alice);
          prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
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
            expect(mocQueueBalance).to.be.equal(0);
            const executorBalanceAfter = await ethersGetBalance(executor);
            expect(executorBalanceAfter).to.be.equal(redeemTCandTPExecFee.add(executorBalanceBefore));
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
            it("THEN TC and TPs are returned", async function () {
              assertPrec(prevTCBalance, await mocFunctions.tcBalanceOf(alice));
              assertPrec(prevTPBalance, await mocFunctions.tpBalanceOf(TP_0, alice));
            });
          });
        });
      });
      describe("WHEN she registers a joint redeem Operation of 100 TC and only max 80 TP", function () {
        let alicePrevBalance: Balance;
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevTCBalance = await mocFunctions.tcBalanceOf(alice);
          prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          alicePrevBalance = await ethersGetBalance(alice);
          await mocFunctions.redeemTCandTP({ from: alice, qTC: 100, qTP: 80, execute: false });
        });
        describe("AND execution is evaluated", function () {
          beforeEach(async function () {
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with Insufficient qTP, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.INSUFFICIENT_QTP_SENT, "Insufficient tp sent");
          });
          it("THEN TC and TPs are returned", async function () {
            assertPrec(prevTCBalance, await mocFunctions.tcBalanceOf(alice));
            assertPrec(prevTPBalance, await mocFunctions.tpBalanceOf(TP_0, alice));
          });
          it("THEN alice spent the execution fees", async function () {
            assertPrec(await ethersGetBalance(alice), alicePrevBalance.sub(redeemTCandTPExecFee));
          });
        });
      });
      describe("WHEN she registers a joint redeem Operation of 10 TC and max 80 TP expecting at least 100 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevTCBalance = await mocFunctions.tcBalanceOf(alice);
          prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          await mocFunctions.redeemTCandTP({ from: alice, qTC: 10, qTP: 80, qACmin: 100, execute: false });
        });
        describe("AND execution is evaluated", function () {
          beforeEach(async function () {
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with Insufficient qTP, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.QAC_BELOW_MINIMUM, "qAC below minimum required");
          });
          it("THEN TC and TPs are returned", async function () {
            assertPrec(prevTCBalance, await mocFunctions.tcBalanceOf(alice));
            assertPrec(prevTPBalance, await mocFunctions.tpBalanceOf(TP_0, alice));
          });
        });
      });
    });
  });
};

export { redeemTCandTPQueueBehavior };
