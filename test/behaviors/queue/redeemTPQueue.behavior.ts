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

const redeemTPQueueBehavior = function () {
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let mocQueue: MocQueue;
  let operId: OperId;
  let executor: Address;
  let alice: Address;
  let bob: Address;
  let execTx: ContractTransaction;
  let prevTPBalance: Balance;
  const TP_0 = 0;
  const {
    execFeeParams: { tpRedeemExecFee },
  } = getNetworkDeployParams(hre).queueParams;
  describe("Feature: redeem Pegged Token", function () {
    beforeEach(async function () {
      mocFunctions = this.mocFunctions;
      ({ mocImpl, mocQueue } = this.mocContracts);
      ({ alice, bob, deployer: executor } = await getNamedAccounts());
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
          prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          await mocFunctions.redeemTP({ from: alice, qTP: 20, qACmin: 21, execute: false });
        });
        describe("AND execution is evaluated", function () {
          beforeEach(async function () {
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with qAC below min expected, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.QAC_BELOW_MINIMUM, "qAC below minimum required");
          });
          it("THEN TP is returned", async function () {
            assertPrec(prevTPBalance, await mocFunctions.tpBalanceOf(TP_0, alice));
          });
        });
      });
      describe("AND Pegged Token revaluates", function () {
        beforeEach(async function () {
          await mocFunctions.mintTP({ from: bob, qTP: 20000 });
          await mocFunctions.pokePrice(TP_0, "0.1");
        });
        describe("WHEN Alice registers a redeem Operation for her TPs", function () {
          let alicePrevBalance: Balance;
          beforeEach(async function () {
            operId = await mocQueue.operIdCount();
            prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
            alicePrevBalance = await ethersGetBalance(alice);
            await mocFunctions.redeemTP({ from: alice, qTP: 20, execute: false });
          });
          describe("AND execution is evaluated", function () {
            beforeEach(async function () {
              execTx = await mocFunctions.executeQueue();
            });
            it("THEN Operations fails with LowCoverage, and Operation Error event is emitted", async function () {
              await expect(execTx)
                .to.emit(mocQueue, "OperationError")
                .withArgs(operId, ERROR_SELECTOR.LOW_COVERAGE, "Low coverage");
            });
            it("THEN TP is returned", async function () {
              assertPrec(prevTPBalance, await mocFunctions.tpBalanceOf(TP_0, alice));
            });
            it("THEN alice spent the execution fees", async function () {
              assertPrec(await ethersGetBalance(alice), alicePrevBalance.sub(tpRedeemExecFee));
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
            expect(mocQueueBalance).to.be.equal(0);
            const executorBalanceAfter = await ethersGetBalance(executor);
            expect(executorBalanceAfter).to.be.equal(tpRedeemExecFee.add(executorBalanceBefore));
          });
        });
      });
    });
  });
};

export { redeemTPQueueBehavior };
