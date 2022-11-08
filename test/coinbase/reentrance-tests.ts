import { fixtureDeployedMocCoinbase } from "./fixture";
import { MocCACoinbase, ReentrancyAttackerMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { ERRORS, pEth } from "../helpers/utils";
import { Address } from "hardhat-deploy/types";
import { tpParams } from "../helpers/utils";

describe("Feature: MocCoinbase reentrance tests", () => {
  let mocImpl: MocCACoinbase;
  let mocContracts: any;
  let mocFunctions: any;
  let deployer: Address;
  let reentrancyAttacker: ReentrancyAttackerMock;
  let reentracyAttack: (op: string, overrides?: any) => any;
  let expectRevertReentrancyGuard: (it: any) => any;

  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      ({ deployer } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
      mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsCoinbase(mocContracts);
      ({ mocImpl } = mocContracts);
      const factory = await ethers.getContractFactory("ReentrancyAttackerMock");
      reentrancyAttacker = await factory.deploy();
      // mint TC to reentrance attacker contract
      await mocFunctions.mintTCto({ from: deployer, to: reentrancyAttacker.address, qTC: 1000 });
      // mint TP to reentrance attacker contract
      await mocFunctions.mintTPto({ i: 0, from: deployer, to: reentrancyAttacker.address, qTP: 100 });

      reentracyAttack = async (op: string, overrides?: any) => {
        overrides
          ? await reentrancyAttacker.forward(mocImpl.address, op, true, overrides)
          : await reentrancyAttacker.forward(mocImpl.address, op, false);
      };
      expectRevertReentrancyGuard = it => expect(it).to.be.revertedWith(ERRORS.REENTRACYGUARD);
    });

    describe("WHEN a reentrance attacker contract reentrant mintTC", () => {
      it("THEN tx fails because there is a reentrant call", async () => {
        const op = mocImpl.interface.encodeFunctionData("mintTC", [pEth(1)]);
        await expectRevertReentrancyGuard(reentracyAttack(op, { value: pEth(100) }));
      });
    });
    describe("WHEN a reentrance attacker contract reentrant redeemTC", () => {
      it("THEN tx fails because there is a reentrant call", async () => {
        const op = mocImpl.interface.encodeFunctionData("redeemTC", [pEth(1), 0]);
        await expectRevertReentrancyGuard(reentracyAttack(op));
      });
    });
    describe("WHEN a reentrance attacker contract reentrant mintTP", () => {
      it("THEN tx fails because there is a reentrant call", async () => {
        const op = mocImpl.interface.encodeFunctionData("mintTP", [0, pEth(1)]);
        await expectRevertReentrancyGuard(reentracyAttack(op, { value: pEth(100) }));
      });
    });
    describe("WHEN a reentrance attacker contract reentrant redeemTP", () => {
      it("THEN tx fails because there is a reentrant call", async () => {
        const op = mocImpl.interface.encodeFunctionData("redeemTP", [0, pEth(1), 0]);
        await expectRevertReentrancyGuard(reentracyAttack(op));
      });
    });
    describe("WHEN a reentrance attacker contract reentrant swapTPforTP", () => {
      it("THEN tx fails because there is a reentrant call", async () => {
        const op = mocImpl.interface.encodeFunctionData("swapTPforTP", [0, 1, pEth(1), 0]);
        await expectRevertReentrancyGuard(reentracyAttack(op, { value: pEth(100) }));
      });
    });
    describe("WHEN a reentrance attacker contract reentrant redeemTCandTP", () => {
      it("THEN tx fails because there is a reentrant call", async () => {
        const op = mocImpl.interface.encodeFunctionData("redeemTCandTP", [0, pEth(1), pEth(100), 0]);
        await expectRevertReentrancyGuard(reentracyAttack(op));
      });
    });
  });
});
