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
  ERRORS,
  noVendor,
} from "../../helpers/utils";
import { MocCACoinbase, MocCARC20, MocQueue } from "../../../typechain";

const redeemTCQueueBehavior = function () {
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let mocQueue: MocQueue;
  let operId: OperId;
  let deployer: Address;
  let alice: Address;
  let execTx: ContractTransaction;
  let prevTCBalance: Balance;
  const TP_0 = 0;
  const {
    execFeeParams: { tcRedeemExecFee },
  } = getNetworkDeployParams(hre).queueParams;
  describe("Feature: redeem Collateral Token", function () {
    beforeEach(async function () {
      mocFunctions = this.mocFunctions;
      ({ mocImpl, mocQueue } = this.mocContracts);
      ({ deployer, alice } = await getNamedAccounts());
    });
    describe("GIVEN Alice has 20 TC", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 20 });
      });
      describe("WHEN an user tries to execute a redeem TC operation without the queue", function () {
        it("THEN tx reverts only MocQueue can execute operations", async function () {
          const redeemTCParams = {
            qTC: 1,
            qACmin: 1,
            sender: deployer,
            recipient: deployer,
            vendor: noVendor,
          };
          await expect(mocImpl.execRedeemTC(redeemTCParams)).to.be.revertedWithCustomError(mocImpl, ERRORS.ONLY_QUEUE);
        });
      });
      describe("WHEN alice registers a redeems 20 TC Operation, expecting at least 21 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevTCBalance = await mocFunctions.tcBalanceOf(alice);
          await mocFunctions.redeemTC({ from: alice, qTC: 20, qACmin: 21, execute: false });
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
          it("THEN TC is returned", async function () {
            assertPrec(prevTCBalance, await mocFunctions.tcBalanceOf(alice));
          });
        });
      });

      describe("AND there are 200 TP0", function () {
        beforeEach(async function () {
          await mocFunctions.mintTP({ from: deployer, qTP: 200 });
        });
        describe("WHEN Alice registers a redeem Operation for her TCs", function () {
          beforeEach(async function () {
            operId = await mocQueue.operIdCount();
            prevTCBalance = await mocFunctions.tcBalanceOf(alice);
            await mocFunctions.redeemTC({ from: alice, qTC: 20, execute: false });
          });
          describe("AND execution is evaluated", function () {
            beforeEach(async function () {
              execTx = await mocFunctions.executeQueue();
            });
            it("THEN Operations fails with Insufficient tc to redeem, and Operation Error event is emitted", async function () {
              await expect(execTx)
                .to.emit(mocQueue, "OperationError")
                .withArgs(operId, ERROR_SELECTOR.INSUFFICIENT_TC_TO_REDEEM, "Insufficient tc to redeem");
            });
            it("THEN TC is returned", async function () {
              assertPrec(prevTCBalance, await mocFunctions.tcBalanceOf(alice));
            });
          });
        });
        describe("AND Pegged Token revaluates", function () {
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, "35");
          });
          describe("WHEN Alice registers a redeem Operation for her TCs", function () {
            let alicePrevBalance: Balance;
            beforeEach(async function () {
              operId = await mocQueue.operIdCount();
              prevTCBalance = await mocFunctions.tcBalanceOf(alice);
              alicePrevBalance = await ethersGetBalance(alice);
              await mocFunctions.redeemTC({ from: alice, qTC: 20, execute: false });
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
              it("THEN TC is returned", async function () {
                assertPrec(prevTCBalance, await mocFunctions.tcBalanceOf(alice));
              });
              it("THEN alice spent the execution fees", async function () {
                assertPrec(await ethersGetBalance(alice), alicePrevBalance.sub(tcRedeemExecFee));
              });
            });
          });
        });
      });

      describe("WHEN she registers an Operation to redeems 12 TC", function () {
        let queueTx: ContractTransaction;
        let executorBalanceBefore: Balance;
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          prevTCBalance = await mocFunctions.tcBalanceOf(alice);
          queueTx = await mocFunctions.redeemTC({ from: alice, qTC: 12, execute: false });
        });
        it("THEN an operation queued event is emitted", async function () {
          await expect(queueTx)
            .to.emit(mocQueue, "OperationQueued")
            .withArgs(mocImpl.address, operId, OperType.redeemTC);
        });
        it("THEN Alice TC balance decreases by 12, as her funds are locked", async function () {
          assertPrec(prevTCBalance.sub(await mocFunctions.tcBalanceOf(alice)), 12);
        });
        it("THEN Bucket balance increases by 12, as the funds are now locked there", async function () {
          assertPrec(await mocFunctions.tcBalanceOf(mocImpl.address), 12);
        });
        describe("WHEN the operation is executed", function () {
          beforeEach(async function () {
            executorBalanceBefore = await ethersGetBalance(deployer);
            await mocFunctions.executeQueue();
          });
          it("THEN Alice TC balance doesn't change", async function () {
            assertPrec(prevTCBalance.sub(await mocFunctions.tcBalanceOf(alice)), 12);
          });
          it("THEN Bucket TC balance is back to zero as tokes were burned", async function () {
            assertPrec(await mocFunctions.tcBalanceOf(mocImpl.address), 0);
          });
          it("THEN queue executor receives the corresponding execution fees", async function () {
            const mocQueueBalance = await ethersGetBalance(mocQueue.address);
            expect(mocQueueBalance).to.be.equal(0);
            const executorBalanceAfter = await ethersGetBalance(deployer);
            expect(executorBalanceAfter).to.be.equal(tcRedeemExecFee.add(executorBalanceBefore));
          });
        });
      });
    });
  });
};

export { redeemTCQueueBehavior };
