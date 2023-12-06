import { ethers, getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { MocCACoinbase, MocQueue, MocRC20, NonPayableMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { redeemTCBehavior } from "../behaviors/redeemTC.behavior";
import { Balance, ERROR_SELECTOR, OperId, OperType, pEth, tpParams } from "../helpers/utils";
import { assertPrec } from "../helpers/assertHelper";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase redeem TC", function () {
  describe("GIVEN a MocCoinbase implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
    });
    redeemTCBehavior();
  });

  describe("GIVEN a MocCoinbase implementation deployed behind MocQueue", () => {
    let mocImpl: MocCACoinbase;
    let mocCollateralToken: MocRC20;
    let mocQueue: MocQueue;
    let mocFunctions: any;
    let deployer: Address;
    before(async () => {
      ({ deployer } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsCoinbase(mocContracts);
      ({ mocImpl, mocQueue, mocCollateralToken } = mocContracts);
    });
    describe("AND a non payable contract", () => {
      let nonPayable: NonPayableMock;
      let operId: OperId;
      before(async () => {
        const factory = await ethers.getContractFactory("NonPayableMock");
        nonPayable = await factory.deploy();
      });
      describe("WHEN it registers a redeemTC operation", () => {
        before(async () => {
          // mint TC to non payable contract
          await mocFunctions.mintTC({ from: deployer, to: nonPayable.address, qTC: 1000 });
          // non payable contract sends TC approval to Moc
          let data = mocCollateralToken.interface.encodeFunctionData("approve", [mocImpl.address, pEth(1)]);
          await nonPayable.forward(mocCollateralToken.address, data);

          operId = await mocQueue.operIdCount();
          // non payable contract registers redeemTC operation
          data = mocImpl.interface.encodeFunctionData("redeemTC", [pEth(1), 0]);
          await nonPayable.forward(mocImpl.address, data, { value: await mocQueue.execFee(OperType.redeemTC) });
        });
        describe("AND execution is evaluated", () => {
          let execTx: ContractTransaction;
          let prevTCBalance: Balance;
          before(async () => {
            prevTCBalance = await mocFunctions.tcBalanceOf(nonPayable.address);
            execTx = await mocQueue.execute(deployer);
          });
          it("THEN Operations fails with Unhandled Error", async () => {
            await expect(execTx).to.emit(mocQueue, "UnhandledError").withArgs(operId, ERROR_SELECTOR.TRANSFER_FAILED);
          });
          it("THEN TC is returned", async () => {
            assertPrec(prevTCBalance.add(pEth(1)), await mocFunctions.tcBalanceOf(nonPayable.address));
          });
        });
      });
    });
  });
});
