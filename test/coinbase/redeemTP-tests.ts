import { ethers, getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { MocCACoinbase, MocQueue, MocRC20, NonPayableMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { redeemTPBehavior } from "../behaviors/redeemTP.behavior";
import { redeemTPQueueBehavior } from "../behaviors/queue/redeemTPQueue.behavior";
import { Balance, ERROR_SELECTOR, OperId, OperType, pEth, tpParams } from "../helpers/utils";
import { assertPrec } from "../helpers/assertHelper";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase redeem TP", function () {
  describe("GIVEN a MocCoinbase implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
    });
    redeemTPBehavior();
  });

  describe("GIVEN a MocCoinbase implementation deployed behind MocQueue", function () {
    let mocImpl: MocCACoinbase;
    let tp: MocRC20;
    let mocQueue: MocQueue;
    let mocFunctions: any;
    let deployer: Address;
    beforeEach(async function () {
      ({ deployer } = await getNamedAccounts());
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
    redeemTPQueueBehavior();

    describe("AND a non payable contract", () => {
      let nonPayable: NonPayableMock;
      let operId: OperId;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("NonPayableMock");
        nonPayable = await factory.deploy();
      });
      describe("WHEN it registers a redeemTP operation", () => {
        beforeEach(async () => {
          // mint TC to non payable contract
          await mocFunctions.mintTC({ from: deployer, to: nonPayable.address, qTC: 1000 });
          // mint TP to non payable contract
          await mocFunctions.mintTP({ from: deployer, to: nonPayable.address, qTP: 100 });
          // non payable contract sends TP approval to Moc
          let data = tp.interface.encodeFunctionData("approve", [mocImpl.address, pEth(1)]);
          await nonPayable.forward(tp.address, data);

          operId = await mocQueue.operIdCount();
          // non payable contract registers redeemTP operation
          data = mocImpl.interface.encodeFunctionData("redeemTP", [tp.address, pEth(1), 0]);
          await nonPayable.forward(mocImpl.address, data, { value: await mocQueue.execFee(OperType.redeemTP) });
        });
        describe("AND execution is evaluated", () => {
          let execTx: ContractTransaction;
          let prevTPBalance: Balance;
          beforeEach(async () => {
            prevTPBalance = await mocFunctions.tpBalanceOf(0, nonPayable.address);
            execTx = await mocQueue.execute(deployer);
          });
          it("THEN Operations fails with Unhandled Error", async () => {
            await expect(execTx).to.emit(mocQueue, "UnhandledError").withArgs(operId, ERROR_SELECTOR.TRANSFER_FAILED);
          });
          it("THEN TP is returned", async () => {
            assertPrec(prevTPBalance.add(pEth(1)), await mocFunctions.tpBalanceOf(0, nonPayable.address));
          });
        });
      });
    });
  });
});
