import { expect } from "chai";
import { getNamedAccounts } from "hardhat";
import { ContractTransaction, BigNumber } from "ethers";
import { Address } from "hardhat-deploy/types";
import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { fluxCapacitorBehavior } from "../behaviors/fluxCapacitor.behavior";
import { Balance, ERROR_SELECTOR, pEth, tpParams } from "../helpers/utils";
import { MocCARC20, MocQueue } from "../../typechain";
import { assertPrec } from "../helpers/assertHelper";
import { fixtureDeployedMocRC20 } from "./fixture";

describe("Feature: MocCARC20 Flux capacitor", function () {
  describe("GIVEN a MocCARC20 implementation deployed with mocQueueMock", function () {
    let mocQueue: MocQueue;
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
      ({ mocQueue } = this.mocContracts);
      // on flux capacitor tests all the operations happens in the same block, we need waiting blocks on 0
      await mocQueue.setMinOperWaitingBlk(0);
    });
    fluxCapacitorBehavior();
  });

  describe("GIVEN a MocCARC20 implementation deployed behind MocQueue", function () {
    let mocImpl: MocCARC20;
    let mocFunctions: any;
    let mocQueue: MocQueue;
    let operId: BigNumber;
    let alice: Address;
    let execTx: ContractTransaction;
    let prevACBalance: Balance;
    let prevTPBalance: Balance;
    let prevTCBalance: Balance;
    const TP_0 = 0;
    beforeEach(async function () {
      ({ alice } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20(mocContracts);
      ({ mocImpl, mocQueue } = mocContracts);
      // add collateral
      await mocFunctions.mintTC({ from: alice, qTC: 100000000 });
      // initialize alice with some TP0
      await mocFunctions.mintTP({ from: alice, qTP: 23500000 });

      await mocContracts.maxAbsoluteOpProvider.poke(pEth(10000));
      await mocContracts.maxOpDiffProvider.poke(pEth(5000));
    });
    describe("WHEN an user registers a mint TP operation, exceeding the max flux capacitor parameter", function () {
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        await mocFunctions.mintTP({ from: alice, qTP: 2350235, qACmax: 100000, execute: false });
      });
      describe("AND execution is evaluated", function () {
        beforeEach(async function () {
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          execTx = await mocFunctions.executeQueue();
        });
        it("THEN Operations fails with Unhandled Error", async function () {
          await expect(execTx)
            .to.emit(mocQueue, "UnhandledError")
            .withArgs(operId, ERROR_SELECTOR.INVALID_FLUX_CAPACITOR_OPERATION);
        });
        it("THEN AC is returned", async function () {
          assertPrec(await mocImpl.qACLockedInPending(), 0);
          assertPrec(prevACBalance.add(pEth(100000)), await mocFunctions.acBalanceOf(alice));
        });
      });
    });
    describe("WHEN an user registers a redeem TP operation, exceeding the max flux capacitor parameter", function () {
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        await mocFunctions.redeemTP({ from: alice, qTP: 2473931, execute: false });
      });
      describe("AND execution is evaluated", function () {
        beforeEach(async function () {
          prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          execTx = await mocFunctions.executeQueue();
        });
        it("THEN Operations fails with Unhandled Error", async function () {
          await expect(execTx)
            .to.emit(mocQueue, "UnhandledError")
            .withArgs(operId, ERROR_SELECTOR.INVALID_FLUX_CAPACITOR_OPERATION);
        });
        it("THEN TP is returned", async function () {
          assertPrec(prevTPBalance.add(pEth(2473931)), await mocFunctions.tpBalanceOf(TP_0, alice));
        });
      });
    });
    describe("WHEN an user registers a swap TC for TP operation, exceeding the max flux capacitor parameter", function () {
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        await mocFunctions.swapTCforTP({ from: alice, qTC: 10001, qACmax: 100000, execute: false });
      });
      describe("AND execution is evaluated", function () {
        beforeEach(async function () {
          prevTCBalance = await mocFunctions.tcBalanceOf(alice);
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          execTx = await mocFunctions.executeQueue();
        });
        it("THEN Operations fails with Unhandled Error", async function () {
          await expect(execTx)
            .to.emit(mocQueue, "UnhandledError")
            .withArgs(operId, ERROR_SELECTOR.INVALID_FLUX_CAPACITOR_OPERATION);
        });
        it("THEN TC and AC are returned", async function () {
          assertPrec(prevTCBalance.add(pEth(10001)), await mocFunctions.tcBalanceOf(alice));
          assertPrec(prevACBalance.add(pEth(100000)), await mocFunctions.acBalanceOf(alice));
        });
      });
    });
    describe("WHEN an user registers a swap TP for TC operation, exceeding the max flux capacitor parameter", function () {
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        await mocFunctions.swapTPforTC({ from: alice, qTP: 2350235, qACmax: 100000, execute: false });
      });
      describe("AND execution is evaluated", function () {
        beforeEach(async function () {
          prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          execTx = await mocFunctions.executeQueue();
        });
        it("THEN Operations fails with Unhandled Error", async function () {
          await expect(execTx)
            .to.emit(mocQueue, "UnhandledError")
            .withArgs(operId, ERROR_SELECTOR.INVALID_FLUX_CAPACITOR_OPERATION);
        });
        it("THEN TP and AC are returned", async function () {
          assertPrec(prevTPBalance.add(pEth(2350235)), await mocFunctions.tpBalanceOf(TP_0, alice));
          assertPrec(prevACBalance.add(pEth(100000)), await mocFunctions.acBalanceOf(alice));
        });
      });
    });
    describe("WHEN an user registers a redeem TC and TP operation, exceeding the max flux capacitor parameter", function () {
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        await mocFunctions.redeemTCandTP({ from: alice, qTC: 45418, qTP: 2350235, execute: false });
      });
      describe("AND execution is evaluated", function () {
        beforeEach(async function () {
          prevTCBalance = await mocFunctions.tcBalanceOf(alice);
          prevTPBalance = await mocFunctions.tpBalanceOf(TP_0, alice);
          execTx = await mocFunctions.executeQueue();
        });
        it("THEN Operations fails with Unhandled Error", async function () {
          await expect(execTx)
            .to.emit(mocQueue, "UnhandledError")
            .withArgs(operId, ERROR_SELECTOR.INVALID_FLUX_CAPACITOR_OPERATION);
        });
        it("THEN TC and Tps are returned", async function () {
          assertPrec(prevTCBalance.add(pEth(45418)), await mocFunctions.tcBalanceOf(alice));
          assertPrec(prevTPBalance.add(pEth(2350235)), await mocFunctions.tpBalanceOf(TP_0, alice));
        });
      });
    });
    describe("WHEN an user registers a mint TC and TP operation, exceeding the max flux capacitor parameter", function () {
      beforeEach(async function () {
        operId = await mocQueue.operIdCount();
        await mocFunctions.mintTCandTP({ from: alice, qTP: 2350235, qACmax: 100000, execute: false });
      });
      describe("AND execution is evaluated", function () {
        beforeEach(async function () {
          prevACBalance = await mocFunctions.acBalanceOf(alice);
          execTx = await mocFunctions.executeQueue();
        });
        it("THEN Operations fails with Unhandled Error", async function () {
          await expect(execTx)
            .to.emit(mocQueue, "UnhandledError")
            .withArgs(operId, ERROR_SELECTOR.INVALID_FLUX_CAPACITOR_OPERATION);
        });
        it("THEN AC is returned", async function () {
          assertPrec(await mocImpl.qACLockedInPending(), 0);
          assertPrec(prevACBalance.add(pEth(100000)), await mocFunctions.acBalanceOf(alice));
        });
      });
    });
  });
});
