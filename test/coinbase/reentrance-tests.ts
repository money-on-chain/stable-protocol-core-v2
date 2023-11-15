import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { MocCACoinbase, ReentrancyAttackerMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { ERRORS, pEth, tpParams } from "../helpers/utils";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe.skip("Feature: MocCoinbase reentrance tests", () => {
  let mocImpl: MocCACoinbase;
  let mocContracts: any;
  let tp0: Address;
  let mocFunctions: any;
  let deployer: Address;
  let reentrancyAttacker: ReentrancyAttackerMock;
  let reentracyAttack: (op: string, overrides?: any) => any;
  let expectRevertReentrancyGuard: (it: any) => any;

  describe("GIVEN a MocCoinbase implementation deployed", function () {
    before(async function () {
      ({ deployer } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
      mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsCoinbase(mocContracts);
      ({ mocImpl } = mocContracts);
      tp0 = mocContracts.mocPeggedTokens[0].address;
      const factory = await ethers.getContractFactory("ReentrancyAttackerMock");
      reentrancyAttacker = await factory.deploy();
      // mint TC to reentrance attacker contract
      await mocFunctions.mintTC({ from: deployer, to: reentrancyAttacker.address, qTC: 1000 });
      // mint TP to reentrance attacker contract
      await mocFunctions.mintTP({ from: deployer, to: reentrancyAttacker.address, qTP: 100 });

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
        const op = mocImpl.interface.encodeFunctionData("mintTP", [tp0, pEth(1)]);
        await expectRevertReentrancyGuard(reentracyAttack(op, { value: pEth(100) }));
      });
    });
    describe("WHEN a reentrance attacker contract reentrant redeemTP", () => {
      it("THEN tx fails because there is a reentrant call", async () => {
        const op = mocImpl.interface.encodeFunctionData("redeemTP", [tp0, pEth(1), 0]);
        await expectRevertReentrancyGuard(reentracyAttack(op));
      });
    });
    describe("WHEN a reentrance attacker contract reentrant swapTPforTP", () => {
      it("THEN tx fails because there is a reentrant call", async () => {
        const tp1 = mocContracts.mocPeggedTokens[1].address;
        const op = mocImpl.interface.encodeFunctionData("swapTPforTP", [tp0, tp1, pEth(1), 0]);
        await expectRevertReentrancyGuard(reentracyAttack(op, { value: pEth(100) }));
      });
    });
    describe("WHEN a reentrance attacker contract reentrant swapTPforTC", () => {
      it("THEN tx fails because there is a reentrant call", async () => {
        const op = mocImpl.interface.encodeFunctionData("swapTPforTC", [tp0, pEth(1), 0]);
        await expectRevertReentrancyGuard(reentracyAttack(op, { value: pEth(100) }));
      });
    });
    describe("WHEN a reentrance attacker contract reentrant swapTCforTP", () => {
      it("THEN tx fails because there is a reentrant call", async () => {
        const op = mocImpl.interface.encodeFunctionData("swapTCforTP", [tp0, pEth(1), 0]);
        await expectRevertReentrancyGuard(reentracyAttack(op, { value: pEth(100) }));
      });
    });
    describe("WHEN a reentrance attacker contract reentrant redeemTCandTP", () => {
      it("THEN tx fails because there is a reentrant call", async () => {
        const op = mocImpl.interface.encodeFunctionData("redeemTCandTP", [tp0, pEth(1), pEth(100), 0]);
        await expectRevertReentrancyGuard(reentracyAttack(op));
      });
    });
    describe("WHEN a reentrance attacker contract reentrant mintTCandTP", () => {
      it("THEN tx fails because there is a reentrant call", async () => {
        const op = mocImpl.interface.encodeFunctionData("mintTCandTP", [tp0, pEth(1)]);
        await expectRevertReentrancyGuard(reentracyAttack(op, { value: pEth(100) }));
      });
    });
  });
});
