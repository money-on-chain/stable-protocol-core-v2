import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { ContractTransaction, BigNumber } from "ethers";
import { MocCARC20Deferred, MocQueue } from "../../../typechain";
import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { redeemTCBehavior } from "../../behaviors/redeemTC.behavior";
import { Balance, ERROR_SELECTOR, OperType, pEth, tpParams } from "../../helpers/utils";
import { assertPrec } from "../../helpers/assertHelper";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocCARC20Deferred redeem TC", function () {
  describe("GIVEN a MocCARC20Deferred implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
    });
    redeemTCBehavior();
  });

  describe("GIVEN a MocCARC20Deferred implementation deployed behind MocQueue", function () {
    let mocImpl: MocCARC20Deferred;
    let mocFunctions: any;
    let mocQueue: MocQueue;
    let operId: BigNumber;
    let deployer: Address;
    let alice: Address;
    const TP_0 = 0;
    beforeEach(async function () {
      ({ deployer, alice } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20Deferred(mocContracts);
      ({ mocImpl, mocQueue } = mocContracts);
    });

    describe("GIVEN Alice has 20 TC", function () {
      beforeEach(async function () {
        await mocFunctions.mintTC({ from: alice, qTC: 20 });
      });
      describe("WHEN alice registers a redeems 20 TC Operation, expecting at least 21 AC", function () {
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          await mocFunctions.redeemTC({ from: alice, qTC: 20, qACmin: 21, execute: false });
        });
        describe("AND execution is evaluated", function () {
          let execTx: ContractTransaction;
          let prevTCBalance: Balance;
          beforeEach(async function () {
            prevTCBalance = await mocFunctions.tcBalanceOf(alice);
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN Operations fails with qAC below min expected, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.QAC_BELOW_MINIMUM, "qAC below minimum required");
          });
          it("THEN TC is returned", async function () {
            assertPrec(prevTCBalance.add(pEth(20)), await mocFunctions.tcBalanceOf(alice));
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
            await mocFunctions.redeemTC({ from: alice, qTC: 20, execute: false });
          });
          describe("AND execution is evaluated", function () {
            let execTx: ContractTransaction;
            let prevTCBalance: Balance;
            beforeEach(async function () {
              prevTCBalance = await mocFunctions.tcBalanceOf(alice);
              execTx = await mocFunctions.executeQueue();
            });
            it("THEN Operations fails with Insufficient tc to redeem, and Operation Error event is emitted", async function () {
              await expect(execTx)
                .to.emit(mocQueue, "OperationError")
                .withArgs(operId, ERROR_SELECTOR.INSUFFICIENT_TC_TO_REDEEM, "Insufficient tc to redeem");
            });
            it("THEN TC is returned", async function () {
              assertPrec(prevTCBalance.add(pEth(20)), await mocFunctions.tcBalanceOf(alice));
            });
          });
        });
        describe("AND Pegged Token revaluates", function () {
          beforeEach(async function () {
            await mocFunctions.pokePrice(TP_0, "35");
          });
          describe("WHEN Alice registers a redeem Operation for her TCs", function () {
            beforeEach(async function () {
              operId = await mocQueue.operIdCount();
              await mocFunctions.redeemTC({ from: alice, qTC: 20, execute: false });
            });
            describe("AND execution is evaluated", function () {
              let execTx: ContractTransaction;
              let prevTCBalance: Balance;
              beforeEach(async function () {
                prevTCBalance = await mocFunctions.tcBalanceOf(alice);
                execTx = await mocFunctions.executeQueue();
              });
              it("THEN Operations fails with LowCoverage, and Operation Error event is emitted", async function () {
                await expect(execTx)
                  .to.emit(mocQueue, "OperationError")
                  .withArgs(operId, ERROR_SELECTOR.LOW_COVERAGE, "Low coverage");
              });
              it("THEN TC is returned", async function () {
                assertPrec(prevTCBalance.add(pEth(20)), await mocFunctions.tcBalanceOf(alice));
              });
            });
          });
        });
      });

      describe("WHEN she registers an Operation to redeems 12 TC", function () {
        let queueTx: ContractTransaction;
        beforeEach(async function () {
          operId = await mocQueue.operIdCount();
          queueTx = await mocFunctions.redeemTC({ from: alice, qTC: 12, execute: false });
        });
        it("THEN an operation queued event is emitted", async function () {
          await expect(queueTx)
            .to.emit(mocQueue, "OperationQueued")
            .withArgs(mocImpl.address, operId, OperType.redeemTC);
        });
        it("THEN Alice TC balance decreases by 12, as her funds are locked", async function () {
          assertPrec(await mocFunctions.tcBalanceOf(alice), 8);
        });
        it("THEN Bucket balance increases by 12, as the funds are now locked there", async function () {
          assertPrec(await mocFunctions.tcBalanceOf(mocImpl.address), 12);
        });
        describe("WHEN the operation is executed", function () {
          beforeEach(async function () {
            await mocFunctions.executeQueue();
          });
          it("THEN Alice TC balance doesn't change", async function () {
            assertPrec(await mocFunctions.tcBalanceOf(alice), 8);
          });
          it("THEN Bucket TC balance is back to zero as tokes were burned", async function () {
            assertPrec(await mocFunctions.tcBalanceOf(mocImpl.address), 0);
          });
        });
      });
    });
  });
});
