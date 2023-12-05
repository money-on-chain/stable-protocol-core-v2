import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { mintTCandTPBehavior } from "../behaviors/mintTCandTP.behavior";
import { mintTCandTPQueueBehavior } from "../behaviors/queue/mintTCandTPQueue.behavior";
import { Balance, ERROR_SELECTOR, OperId, OperType, pEth, tpParams } from "../helpers/utils";
import { MocCACoinbase, MocQueue, MocRC20, NonPayableMock } from "../../typechain";
import { assertPrec } from "../helpers/assertHelper";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase mint TC and TP", function () {
  describe("GIVEN a MocCoinbase implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
    });
    mintTCandTPBehavior();
  });

  describe("GIVEN a MocCoinbase implementation deployed behind MocQueue", function () {
    let mocImpl: MocCACoinbase;
    let tp: MocRC20;
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
      ({
        mocImpl,
        mocQueue,
        mocPeggedTokens: [tp],
      } = this.mocContracts);
    });
    mintTCandTPQueueBehavior();

    describe("AND a non payable contract", () => {
      let nonPayable: NonPayableMock;
      let operId: OperId;
      const qACSent = pEth(100);
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("NonPayableMock");
        nonPayable = await factory.deploy();
      });
      describe("WHEN it registers a mintTCandTP operation with exceeded amount of coinbase", () => {
        beforeEach(async () => {
          operId = await mocQueue.operIdCount();
          // non payable contract registers mintTCandTP operation
          const data = mocImpl.interface.encodeFunctionData("mintTCandTP", [tp.address, pEth(1)]);
          await nonPayable.forward(mocImpl.address, data, {
            value: (await mocQueue.execFee(OperType.mintTCandTP)).add(qACSent),
          });
        });
        describe("AND execution is evaluated", () => {
          let execTx: ContractTransaction;
          let prevACBalance: Balance;
          beforeEach(async () => {
            prevACBalance = await mocFunctions.assetBalanceOf(deployer);
            execTx = await mocQueue.execute(feeRecipient);
          });
          it("THEN Operations fails with Unhandled Error because non payable contract cannot receive the surplus AC", async () => {
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
