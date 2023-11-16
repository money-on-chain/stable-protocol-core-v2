import { expect } from "chai";
import { getNamedAccounts } from "hardhat";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { ContractTransaction, BigNumber } from "ethers";
import { Address } from "hardhat-deploy/types";
import { mocFunctionsRC20Deferred } from "../helpers/mocFunctionsRC20Deferred";
import { pEth, tpParams } from "../helpers/utils";
import { MocQueue } from "../../typechain";
import { fixtureDeployedMocRC20 } from "../rc20/fixture";

describe("Feature: MocQueue flux capacitor", function () {
  let mocFunctions: any;
  describe("GIVEN a MocQueue with min waiting set to 10 blocks", function () {
    let mocQueue: MocQueue;
    let operId: BigNumber;
    let executor: Address;
    let alice: Address;
    let bob: Address;
    beforeEach(async function () {
      ({ deployer: executor, alice, bob } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();

      ({ mocQueue } = mocContracts);
      mocFunctions = await mocFunctionsRC20Deferred(mocContracts);
      // add collateral
      await mocFunctions.mintTC({ from: alice, qTC: 100000000 });

      await mocContracts.maxAbsoluteOpProvider.poke(pEth(10000));
      await mocContracts.maxOpDiffProvider.poke(pEth(5000));
    });
    describe("WHEN both Alice and Bob register 4 valid operations", function () {
      let execTx: ContractTransaction;
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        await Promise.all([
          mocFunctions.mintTP({ from: alice, qTP: 2350000, execute: false }),
          mocFunctions.mintTC({ from: bob, qTC: 10, execute: false }),
          mocFunctions.mintTP({ from: alice, qTP: 235000, execute: false }),
          mocFunctions.mintTC({ from: bob, qTC: 10, execute: false }),
        ]);
      });
      describe("AND queue is executed", function () {
        beforeEach(async function () {
          execTx = await mocFunctions.executeQueue();
        });
        it("THEN only the first 2 are executed because the max flux capacitor operation is reached", async function () {
          await expect(execTx).to.emit(mocQueue, "OperationExecuted").withArgs(executor, operId);
          await expect(execTx).to.emit(mocQueue, "OperationExecuted").withArgs(executor, operId.add(1));
        });
        describe("AND queue is executed after 10 blocks", function () {
          beforeEach(async function () {
            await mine(10);
            execTx = await mocFunctions.executeQueue();
          });
          it("THEN no operation is executed because the flux capacitor is still charged", async function () {
            await expect(execTx).not.to.emit(mocQueue, "OperationExecuted");
          });
        });
        describe("AND a new operation is enqueued", function () {
          beforeEach(async function () {
            await mocFunctions.redeemTP({ from: alice, qTP: 235000, execute: false });
          });
          describe("AND queue is executed after 1000 blocks", function () {
            beforeEach(async function () {
              await mine(1000);
              execTx = await mocFunctions.executeQueue();
            });
            it("THEN the 3 remaining operations are executed", async function () {
              await expect(execTx).to.emit(mocQueue, "OperationExecuted").withArgs(executor, operId.add(2));
              await expect(execTx).to.emit(mocQueue, "OperationExecuted").withArgs(executor, operId.add(3));
              await expect(execTx).to.emit(mocQueue, "OperationExecuted").withArgs(executor, operId.add(4));
            });
          });
        });
      });
    });
  });
});
