import { ethers, getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { MocCACoinbase, MocQueue, NonPayableMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { mintTCBehavior } from "../behaviors/mintTC.behavior";
import { mintTCQueueBehavior } from "../behaviors/queue/mintTCQueue.behavior";
import { Balance, ERROR_SELECTOR, OperId, OperType, noVendor, pEth, tpParams, ERRORS } from "../helpers/utils";
import { assertPrec } from "../helpers/assertHelper";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase mint TC", function () {
  describe("GIVEN a MocCoinbase implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
    });
    mintTCBehavior();
  });

  describe("GIVEN a MocCoinbase implementation deployed behind MocQueue", function () {
    let mocImpl: MocCACoinbase;
    let mocQueue: MocQueue;
    let mocFunctions: any;
    let deployer: Address;
    let feeRecipient: Address;
    beforeEach(async function () {
      ({ deployer, otherUser: feeRecipient } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, false);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
      mocFunctions = this.mocFunctions;
      ({ mocImpl, mocQueue } = this.mocContracts);
    });
    mintTCQueueBehavior();

    describe("WHEN an user tries to register an operation, sending less execution fees than expected", function () {
      let queueTx: ContractTransaction;
      beforeEach(async function () {
        queueTx = mocFunctions.mintTC({
          from: deployer,
          qTC: 10,
          qACmax: 1,
          execute: false,
          applyPrecision: false,
          execFee: 0,
        });
      });
      it("THEN Tx fails with wrong execution fee", async function () {
        await expect(queueTx).to.be.revertedWithCustomError(mocQueue, ERRORS.WRONG_EXEC_FEES);
      });
    });

    describe("AND a non payable contract", () => {
      let nonPayable: NonPayableMock;
      let operId: OperId;
      const qACSent = pEth(100);
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("NonPayableMock");
        nonPayable = await factory.deploy();
      });
      describe("WHEN it registers a mintTC operation with exceeded amount of coinbase", () => {
        beforeEach(async () => {
          operId = await mocQueue.operIdCount();
          // non payable contract registers mintTC operation
          const data = mocImpl.interface.encodeFunctionData("mintTC", [pEth(1), deployer, noVendor]);
          await nonPayable.forward(mocImpl.address, data, {
            value: (await mocQueue.execFee(OperType.mintTC)).add(qACSent),
          });
        });
        describe("AND execution is evaluated", () => {
          let execTx: ContractTransaction;
          let prevACBalance: Balance;
          beforeEach(async () => {
            prevACBalance = await mocFunctions.assetBalanceOf(deployer);
            execTx = await mocQueue.execute(feeRecipient);
          });
          it("THEN Operations fails with Unhandled Error as non payable contract cannot receive the surplus AC", async () => {
            await expect(execTx).to.emit(mocQueue, "UnhandledError").withArgs(operId, ERROR_SELECTOR.TRANSFER_FAILED);
          });
          it("THEN AC cannot be returned", async () => {
            assertPrec(prevACBalance, await mocFunctions.assetBalanceOf(deployer));
          });
          it("THEN AC is sent to the failedTransferFallback address", async () => {
            const failedTransferFallback = await mocImpl.coinbaseFailedTransferFallback();
            assertPrec(qACSent, await mocFunctions.assetBalanceOf(failedTransferFallback));
          });
        });
      });
    });
  });
});
