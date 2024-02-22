import hre, { ethers, getNamedAccounts } from "hardhat";
import { ContractTransaction, BigNumber } from "ethers";
import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { Address } from "hardhat-deploy/types";
import { FallbackMock, MocCACoinbase, MocQueue, MocRC20 } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { ERROR_SELECTOR, OperType, pEth, tpParams } from "../helpers/utils";
import { getNetworkDeployParams, noVendor } from "../../scripts/utils";
import { fixtureDeployedMocCoinbase } from "./fixture";

const { transferMaxGas } = getNetworkDeployParams(hre).coreParams;
const emitEventGasCost = 1100;
const maxIterations = Math.trunc(transferMaxGas! / emitEventGasCost) + 1;

describe("Feature: MocCoinbase gas attack", function () {
  describe("GIVEN a MocCoinbase implementation deployed behind MocQueue", () => {
    let mocImpl: MocCACoinbase;
    let mocCollateralToken: MocRC20;
    let mocQueue: MocQueue;
    let fallback: FallbackMock;
    let mocFunctions: any;
    let deployer: Address;
    let referenceGasUsed: BigNumber;
    let referenceExecTx: ContractTransaction;
    let redeemTCViaFallback: () => Promise<ContractTransaction>;
    before(async () => {
      ({ deployer } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, false);
      const mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsCoinbase(mocContracts);
      ({ mocImpl, mocQueue, mocCollateralToken } = mocContracts);
      const factory = await ethers.getContractFactory("FallbackMock");
      fallback = await factory.deploy();

      // mint TC to fallback contract
      await mocFunctions.mintTC({ from: deployer, to: fallback.address, qTC: 1000 });
      // fallback contract sends TC approval to Moc
      const data = mocCollateralToken.interface.encodeFunctionData("approve", [mocImpl.address, pEth(10)]);
      await fallback.forward(mocCollateralToken.address, data);
      const redeemTCExecFee = await mocQueue.execFee(OperType.redeemTC);
      redeemTCViaFallback = () => {
        // fallback contract registers redeemTC operation
        const data = mocImpl.interface.encodeFunctionData("redeemTC", [pEth(1), 0, fallback.address, noVendor]);
        return fallback.forward(mocImpl.address, data, { value: redeemTCExecFee });
      };
      // register one redeemTC operation
      await redeemTCViaFallback();
      await fallback.setIterations(0);
      referenceExecTx = await mocQueue.execute(deployer);
      referenceGasUsed = (await referenceExecTx.wait()).gasUsed;
    });
    describe("AND a fallback contract with a redeemTC operation registered", () => {
      describe("WHEN it doesn't consumes extra gas on fallback function", () => {
        describe("AND execution is evaluated", () => {
          it("THEN Operation is executed normally", async () => {
            await expect(referenceExecTx).to.emit(mocQueue, "OperationExecuted");
          });
        });
      });
      describe("WHEN it consumes some minor extra gas on fallback function", () => {
        beforeEach(async () => {
          // register one redeemTC operation
          await redeemTCViaFallback();
          // Each iteration, emits one event, consuming a little extra gas
          await fallback.setIterations(1);
        });
        describe("AND execution is evaluated", () => {
          let execTx: ContractTransaction;
          beforeEach(async () => {
            execTx = await mocQueue.execute(deployer);
          });
          it(`THEN it consumes ≈${emitEventGasCost} more gas`, async () => {
            expect((await execTx.wait()).gasUsed).to.be.closeTo(referenceGasUsed, emitEventGasCost);
          });
          it("THEN Operation is executed normally", async () => {
            await expect(execTx).to.emit(mocQueue, "OperationExecuted");
          });
        });
      });
      describe(`WHEN it consumes a lot of extra gas on fallback function`, () => {
        beforeEach(async () => {
          // register one redeemTC operation
          await redeemTCViaFallback();
          // Each iteration, emits one event, consuming a little extra gas
          await fallback.setIterations(maxIterations);
        });
        describe("AND execution is evaluated", () => {
          let execTx: ContractTransaction;
          beforeEach(async () => {
            execTx = await mocQueue.execute(deployer);
          });
          it("THEN Operations fails with Unhandled Error as capped gas transfer fails", async () => {
            await expect(execTx).to.emit(mocQueue, "UnhandledError").withArgs(anyValue, ERROR_SELECTOR.TRANSFER_FAILED);
          });
        });
      });
    });
  });
});
