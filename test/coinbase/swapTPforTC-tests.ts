import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { swapTPforTCBehavior } from "../behaviors/swapTPforTC.behavior";
import { Balance, ERROR_SELECTOR, OperId, OperType, pEth, tpParams } from "../helpers/utils";
import { MocCACoinbase, MocQueue, MocRC20, NonPayableMock } from "../../typechain";
import { assertPrec } from "../helpers/assertHelper";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase swap TP for TC", function () {
  describe("GIVEN a MocCoinbase implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
    });
    swapTPforTCBehavior();
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
      mocFunctions = await mocFunctionsCoinbase(mocContracts);
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
      describe("WHEN it registers a swapTPforTC operation with exceeded amount of coinbase", () => {
        before(async () => {
          // mint TC to non payable contract
          await mocFunctions.mintTC({ from: deployer, to: nonPayable.address, qTC: 1000 });
          // mint TP to non payable contract
          await mocFunctions.mintTP({ from: deployer, to: nonPayable.address, qTP: 100 });
          // non payable contract sends TP approval to Moc
          let data = tp.interface.encodeFunctionData("approve", [mocImpl.address, pEth(1)]);
          await nonPayable.forward(tp.address, data);

          operId = await mocQueue.operIdCount();
          // non payable contract registers swapTPforTC operation
          data = mocImpl.interface.encodeFunctionData("swapTPforTC", [tp.address, pEth(1), 0]);
          await nonPayable.forward(mocImpl.address, data, {
            value: (await mocQueue.execFee(OperType.swapTPforTC)).add(qACSent),
          });
        });
        describe("AND execution is evaluated", () => {
          let execTx: ContractTransaction;
          let prevTPBalance: Balance;
          let prevACBalance: Balance;
          before(async () => {
            prevTPBalance = await mocFunctions.tpBalanceOf(0, nonPayable.address);
            prevACBalance = await mocFunctions.assetBalanceOf(deployer);
            execTx = await mocQueue.execute(feeRecipient);
          });
          it("THEN Operations fails with Unhandled Error because non payable contract cannot receive the surplus AC", async () => {
            await expect(execTx).to.emit(mocQueue, "UnhandledError").withArgs(operId, ERROR_SELECTOR.TRANSFER_FAILED);
          });
          it("THEN TP is returned", async () => {
            assertPrec(prevTPBalance.add(pEth(1)), await mocFunctions.tpBalanceOf(0, nonPayable.address));
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
