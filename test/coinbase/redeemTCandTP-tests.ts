import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { redeemTCandTPBehavior } from "../behaviors/redeemTCandTP.behavior";
import { redeemTCandTPQueueBehavior } from "../behaviors/queue/redeemTCandTPQueue.behavior";
import { Balance, ERROR_SELECTOR, OperId, OperType, noVendor, pEth, tpParams } from "../helpers/utils";
import { MocCACoinbase, MocQueue, MocRC20, NonPayableMock } from "../../typechain";
import { assertPrec } from "../helpers/assertHelper";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase redeem TC and TP", function () {
  describe("GIVEN a MocCoinbase implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
    });
    redeemTCandTPBehavior();
  });
  describe("GIVEN a MocCoinbase implementation deployed behind MocQueue", function () {
    let mocImpl: MocCACoinbase;
    let mocCollateralToken: MocRC20;
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
        mocCollateralToken,
        mocPeggedTokens: [tp],
      } = this.mocContracts);
    });
    redeemTCandTPQueueBehavior();

    describe("AND a non payable contract", () => {
      let nonPayable: NonPayableMock;
      let operId: OperId;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("NonPayableMock");
        nonPayable = await factory.deploy();
      });
      describe("WHEN it registers a redeemTCandTP operation", () => {
        beforeEach(async () => {
          // mint TC to non payable contract
          await mocFunctions.mintTC({ from: deployer, to: nonPayable.address, qTC: 1000 });
          // mint TP to non payable contract
          await mocFunctions.mintTP({ from: deployer, to: nonPayable.address, qTP: 100 });
          // non payable contract sends TC approval to Moc
          let data = mocCollateralToken.interface.encodeFunctionData("approve", [mocImpl.address, pEth(1)]);
          await nonPayable.forward(mocCollateralToken.address, data);
          // non payable contract sends TP approval to Moc
          data = tp.interface.encodeFunctionData("approve", [mocImpl.address, pEth(100)]);
          await nonPayable.forward(tp.address, data);

          operId = await mocQueue.operIdCount();
          // non payable contract registers redeemTCandTP operation
          data = mocImpl.interface.encodeFunctionData("redeemTCandTP", [
            tp.address,
            pEth(1),
            pEth(100),
            0,
            nonPayable.address,
            noVendor,
          ]);
          await nonPayable.forward(mocImpl.address, data, { value: await mocQueue.execFee(OperType.redeemTCandTP) });
        });
        describe("AND execution is evaluated", () => {
          let execTx: ContractTransaction;
          let prevTCBalance: Balance;
          let prevTPBalance: Balance;
          beforeEach(async () => {
            prevTCBalance = await mocFunctions.tcBalanceOf(nonPayable.address);
            prevTPBalance = await mocFunctions.tpBalanceOf(0, nonPayable.address);
            execTx = await mocQueue.execute(deployer);
          });
          it("THEN Operations fails with Unhandled Error as non payable contract cannot receive coinbase", async () => {
            await expect(execTx).to.emit(mocQueue, "UnhandledError").withArgs(operId, ERROR_SELECTOR.TRANSFER_FAILED);
          });
          it("THEN TC is returned", async () => {
            assertPrec(prevTCBalance.add(pEth(1)), await mocFunctions.tcBalanceOf(nonPayable.address));
          });
          it("THEN TP is returned", async () => {
            assertPrec(prevTPBalance.add(pEth(100)), await mocFunctions.tpBalanceOf(0, nonPayable.address));
          });
        });
      });
    });
  });
});
