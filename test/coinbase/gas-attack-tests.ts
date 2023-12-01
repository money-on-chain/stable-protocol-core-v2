import hre, { ethers, getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { FallbackMock, MocCACoinbase, MocQueue, MocRC20 } from "../../typechain";
import { mocFunctionsCoinbaseDeferred } from "../helpers/mocFunctionsCoinbaseDeferred";
import { ERROR_SELECTOR, OperId, OperType, pEth, tpParams } from "../helpers/utils";
import { getNetworkDeployParams } from "../../scripts/utils";
import { fixtureDeployedMocCoinbase } from "./fixture";

const { transferMaxGas } = getNetworkDeployParams(hre).coreParams;
const emitEventGasCost = 1100;
const maxIterations = Math.trunc(transferMaxGas! / emitEventGasCost) + 1;

describe("Feature: MocCoinbase gas attack", function () {
  describe("GIVEN a MocCoinbase implementation deployed behind MocQueue", () => {
    let mocImpl: MocCACoinbase;
    let mocCollateralToken: MocRC20;
    let mocQueue: MocQueue;
    let mocFunctions: any;
    let deployer: Address;
    let normalGasUsed: any;
    beforeEach(async () => {
      ({ deployer } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsCoinbaseDeferred(mocContracts);
      ({ mocImpl, mocQueue, mocCollateralToken } = mocContracts);
    });
    describe("AND a fallback contract with a redeemTC operation registered", () => {
      let fallback: FallbackMock;
      let operId: OperId;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("FallbackMock");
        fallback = await factory.deploy();

        // mint TC to fallback contract
        await mocFunctions.mintTC({ from: deployer, to: fallback.address, qTC: 1000 });
        // fallback contract sends TC approval to Moc
        let data = mocCollateralToken.interface.encodeFunctionData("approve", [mocImpl.address, pEth(1)]);
        await fallback.forward(mocCollateralToken.address, data);

        operId = await mocQueue.operIdCount();
        // fallback contract registers redeemTC operation
        data = mocImpl.interface.encodeFunctionData("redeemTC", [pEth(1), 0]);
        await fallback.forward(mocImpl.address, data, { value: await mocQueue.execFee(OperType.redeemTC) });
      });
      describe("WHEN it doesn't emit any event on fallback function", () => {
        beforeEach(async () => {
          await fallback.setIterations(0);
        });
        describe("AND execution is evaluated", () => {
          let execTx: ContractTransaction;
          beforeEach(async () => {
            execTx = await mocQueue.execute(deployer);
            normalGasUsed = (await execTx.wait()).gasUsed;
          });
          it("THEN Operation doesn't fail", async () => {
            await expect(execTx).not.to.emit(mocQueue, "UnhandledError");
          });
        });
      });
      describe("WHEN it emits 1 event on fallback function", () => {
        beforeEach(async () => {
          await fallback.setIterations(1);
        });
        describe("AND execution is evaluated", () => {
          let execTx: ContractTransaction;
          beforeEach(async () => {
            execTx = await mocQueue.execute(deployer);
          });
          it(`THEN consumes ≈${emitEventGasCost} more gas`, async () => {
            expect((await execTx.wait()).gasUsed.sub(normalGasUsed)).to.be.closeTo(emitEventGasCost, 10);
          });
          it("THEN Operation doesn't fail", async () => {
            await expect(execTx).not.to.emit(mocQueue, "UnhandledError");
          });
        });
      });
      describe(`WHEN it emits ${maxIterations} event on fallback function`, () => {
        beforeEach(async () => {
          await fallback.setIterations(maxIterations);
        });
        describe("AND execution is evaluated", () => {
          let execTx: ContractTransaction;
          beforeEach(async () => {
            execTx = await mocQueue.execute(deployer);
          });
          it("THEN Operations fails with Unhandled Error", async () => {
            await expect(execTx).to.emit(mocQueue, "UnhandledError").withArgs(operId, ERROR_SELECTOR.TRANSFER_FAILED);
          });
        });
      });
    });
  });
});
