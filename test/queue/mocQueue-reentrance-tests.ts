import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { MocQueue, ReentrancyAttackerMock } from "../../typechain";
import { ERRORS, EXECUTOR_ROLE, tpParams } from "../helpers/utils";
import { fixtureDeployedMocRC20 } from "../rc20/fixture";
import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";

describe("Feature: MocQueue reentrance tests", () => {
  let mocQueue: MocQueue;
  let mocContracts: any;
  let mocFunctions: any;
  let deployer: Address;
  let reentrancyAttacker: ReentrancyAttackerMock;
  let reentracyAttack: (op: string, overrides?: any) => any;

  describe("GIVEN a MocQueue implementation with queued operations", function () {
    before(async function () {
      ({ deployer } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams, false);
      mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20(mocContracts);
      await mocFunctions.mintTC({ from: deployer, qTC: 1000, execute: false });
      ({ mocQueue } = mocContracts);
      const factory = await ethers.getContractFactory("ReentrancyAttackerMock");
      reentrancyAttacker = await factory.deploy();
      // The attacker needs to be an executor
      await mocQueue.grantRole(EXECUTOR_ROLE, reentrancyAttacker.address);
      reentracyAttack = (op: string) => reentrancyAttacker.forward(mocQueue.address, op, false);
    });

    describe("WHEN a reentrance attacker contract reentrant execute", () => {
      it("THEN tx fails because there is a reentrant call", async () => {
        const op = mocQueue.interface.encodeFunctionData("execute", [reentrancyAttacker.address]);
        await expect(reentracyAttack(op)).to.be.revertedWith(ERRORS.REENTRACYGUARD);
      });
    });
  });
});
