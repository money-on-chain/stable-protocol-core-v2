import { expect } from "chai";
import { ethers } from "hardhat";
import { Address } from "hardhat-deploy/types";
import { pEth, ERRORS } from "../../helpers/utils";
import { MocCARC20, ReentrancyAttackerERC777Mock, ERC777Mock } from "../../../typechain";
import { fixtureDeployedMocRC777 } from "./fixture";

describe("Feature: MocCARC20 reentracy tests", function () {
  let mocImpl: MocCARC20;
  let reentrancyAttacker: ReentrancyAttackerERC777Mock;
  let collateralAsset: ERC777Mock;
  let tp0: Address;
  let expectRevertReentrancyGuard: (it: any) => any;

  describe("GIVEN a MocCARC20 implementation deployed", function () {
    before(async () => {
      ({ mocImpl, collateralAsset } = await fixtureDeployedMocRC777(2)());
      const factory = await ethers.getContractFactory("ReentrancyAttackerERC777Mock");
      reentrancyAttacker = await factory.deploy();
      tp0 = await mocImpl.tpTokens(0);
      //mint assets to reentrance attacker contract
      await collateralAsset.mint(reentrancyAttacker.address, pEth(10000));

      // mint TC to reentrance attacker contract
      await collateralAsset.approve(mocImpl.address, pEth(1000));
      await mocImpl.mintTCto(pEth(100), pEth(1000), reentrancyAttacker.address);

      // mint TP to reentrance attacker contract
      await collateralAsset.approve(mocImpl.address, pEth(1000));
      await mocImpl.mintTPto(tp0, pEth(10), pEth(1000), reentrancyAttacker.address);

      // reentrace attacker contract approve collateral asset to mocCore
      await reentrancyAttacker.approve(collateralAsset.address, mocImpl.address, pEth(100000));
      expectRevertReentrancyGuard = it => expect(it).to.be.revertedWith(ERRORS.REENTRACYGUARD);
    });

    describe("WHEN a reentracy attacker contract reentrants redeemTC", function () {
      it("THEN tx fails because there is a reentrant call", async function () {
        const op = mocImpl.interface.encodeFunctionData("redeemTC", [pEth("2"), pEth("1")]);
        await expectRevertReentrancyGuard(reentrancyAttacker.forward(mocImpl.address, op));
      });
    });

    describe("WHEN a reentracy attacker contract reentrants redeemTP", function () {
      it("THEN tx fails because there is a reentrant call", async function () {
        const op = mocImpl.interface.encodeFunctionData("redeemTP", [tp0, 1000, 0]);
        await expectRevertReentrancyGuard(reentrancyAttacker.forward(mocImpl.address, op));
      });
    });

    describe("WHEN a reentracy attacker contract reentrants redeemTCandTP", function () {
      it("THEN tx fails because there is a reentrant call", async function () {
        const op = mocImpl.interface.encodeFunctionData("redeemTCandTP", [tp0, pEth(2), pEth(2), pEth(1)]);
        await expectRevertReentrancyGuard(reentrancyAttacker.forward(mocImpl.address, op));
      });
    });
  });
});
