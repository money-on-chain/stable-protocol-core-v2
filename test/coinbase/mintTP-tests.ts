import { ethers, getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { MocCACoinbase, MocQueue, MocRC20, NonPayableMock } from "../../typechain";
import { mocFunctionsCoinbaseDeferred } from "../helpers/mocFunctionsCoinbaseDeferred";
import { mintTPBehavior } from "../behaviors/mintTP.behavior";
import { assertPrec } from "../helpers/assertHelper";
import { Balance, ERROR_SELECTOR, OperId, OperType, pEth, tpParams } from "../helpers/utils";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase mint TP", function () {
  describe("GIVEN a MocCoinbase implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbaseDeferred(this.mocContracts);
    });
    mintTPBehavior();
  });

  describe("GIVEN a MocCoinbase implementation deployed behind MocQueue", () => {
    let mocImpl: MocCACoinbase;
    let tp: MocRC20;
    let mocQueue: MocQueue;
    let mocFunctions: any;
    let deployer: Address;
    let feeRecipient: Address;
    before(async () => {
      ({ deployer, otherUser: feeRecipient } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsCoinbaseDeferred(mocContracts);
      ({
        mocImpl,
        mocQueue,
        mocPeggedTokens: [tp],
      } = mocContracts);
    });
    describe("AND a non payable contract", () => {
      let nonPayable: NonPayableMock;
      let operId: OperId;
      const qACSent = pEth(100);
      before(async () => {
        const factory = await ethers.getContractFactory("NonPayableMock");
        nonPayable = await factory.deploy();
      });
      describe("WHEN it registers a mintTP operation but there is not collateral in the protocol", () => {
        before(async () => {
          operId = await mocQueue.operIdCount();
          // non payable contract registers mintTP operation
          const data = mocImpl.interface.encodeFunctionData("mintTP", [tp.address, pEth(1)]);
          await nonPayable.forward(mocImpl.address, data, {
            value: (await mocQueue.execFee(OperType.mintTP)).add(qACSent),
          });
        });
        describe("AND execution is evaluated", () => {
          let execTx: ContractTransaction;
          let prevACBalance: Balance;
          before(async () => {
            prevACBalance = await mocFunctions.assetBalanceOf(deployer);
            execTx = await mocQueue.execute(feeRecipient);
          });
          it("THEN Operations fails as there is not enough TP to mint, and Operation Error event is emitted", async function () {
            await expect(execTx)
              .to.emit(mocQueue, "OperationError")
              .withArgs(operId, ERROR_SELECTOR.INSUFFICIENT_TP_TO_MINT, "Insufficient tp to mint");
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
      describe("WHEN it registers a mintTP operation with exceeded amount of coinbase", () => {
        before(async () => {
          // mint TC to add collateral
          await mocFunctions.mintTC({ from: deployer, qTC: 1000 });

          operId = await mocQueue.operIdCount();
          // non payable contract registers mintTP operation
          const data = mocImpl.interface.encodeFunctionData("mintTP", [tp.address, pEth(1)]);
          await nonPayable.forward(mocImpl.address, data, {
            value: (await mocQueue.execFee(OperType.mintTP)).add(qACSent),
          });
        });
        describe("AND execution is evaluated", () => {
          let execTx: ContractTransaction;
          let prevACBalance: Balance;
          let prevFallbackACBalance: Balance;
          let failedTransferFallback: Address;
          before(async () => {
            failedTransferFallback = await mocImpl.coinbaseFailedTransferFallback();
            prevACBalance = await mocFunctions.assetBalanceOf(deployer);
            prevFallbackACBalance = await mocFunctions.assetBalanceOf(failedTransferFallback);
            execTx = await mocQueue.execute(feeRecipient);
          });
          it("THEN Operations fails with Unhandled Error because non payable contract cannot receive the surplus AC", async () => {
            await expect(execTx).to.emit(mocQueue, "UnhandledError").withArgs(operId, ERROR_SELECTOR.TRANSFER_FAILED);
          });
          it("THEN AC cannot be returned", async () => {
            assertPrec(prevACBalance, await mocFunctions.assetBalanceOf(deployer));
          });
          it("THEN AC is sent to the failedTransferFallback address", async () => {
            assertPrec(prevFallbackACBalance.add(qACSent), await mocFunctions.assetBalanceOf(failedTransferFallback));
          });
        });
      });
    });
  });
});
