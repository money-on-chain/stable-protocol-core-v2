import { expect } from "chai";
import { ethers } from "hardhat";
import { Address } from "hardhat-deploy/types";
import { pEth, ERRORS, deployAndAddAssetsERC777 } from "../helpers/utils";
import { MocCAWrapper, MocRC20, ERC777Mock, ReentrancyAttackerERC777Mock } from "../../typechain";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag reentrancy tests", function () {
  let reentrancyAttacker: ReentrancyAttackerERC777Mock;
  let mocPeggedTokens: MocRC20[];
  let mocWrapper: MocCAWrapper;
  let mocCollateralToken: MocRC20;
  let asset: ERC777Mock;
  let tps: Address[];
  const TP_0 = 0;
  let expectRevertReentrancyGuard: (it: any) => any;

  describe("GIVEN a MocCABag implementation deployed", function () {
    before(async function () {
      ({ mocWrapper, mocCollateralToken, mocPeggedTokens } = await fixtureDeployedMocCABag(2, undefined, 0)());
      tps = mocPeggedTokens.map(it => it.address);
      const factory = await ethers.getContractFactory("ReentrancyAttackerERC777Mock");
      reentrancyAttacker = await factory.deploy();

      // deploy and add asset ERC777 to mocWrapper
      ({
        assets: [asset],
      } = await deployAndAddAssetsERC777(mocWrapper, 1));

      //mint assets to reentrance attacker contract
      await asset.mint(reentrancyAttacker.address, pEth(10000));
      // mint TC to reentrance attacker contract
      await asset.approve(mocWrapper.address, pEth(1000));
      await mocWrapper.mintTCto(asset.address, pEth(100), pEth(1000), reentrancyAttacker.address);
      // mint TP to reentrance attacker contract
      await asset.approve(mocWrapper.address, pEth(1000));
      await mocWrapper.mintTPto(asset.address, tps[0], pEth(10), pEth(1000), reentrancyAttacker.address);
      // reentrace attacker contract approve all to mocWrapper
      await Promise.all(
        [asset, mocCollateralToken, mocPeggedTokens[TP_0]].map(contract =>
          reentrancyAttacker.approve(contract.address, mocWrapper.address, pEth(100000)),
        ),
      );
      expectRevertReentrancyGuard = it => expect(it).to.be.revertedWith(ERRORS.REENTRACYGUARD);
    });

    describe("WHEN a reentracy attacker contract reentrants mintTC", function () {
      it("THEN tx fails because there is a reentrant call", async function () {
        const op = mocWrapper.interface.encodeFunctionData("mintTC", [asset.address, pEth("10"), pEth("10").mul(10)]);
        await expectRevertReentrancyGuard(reentrancyAttacker.forward(mocWrapper.address, op));
      });
    });

    describe("WHEN a reentracy attacker contract reentrants redeemTC", function () {
      it("THEN tx fails because there is a reentrant call", async function () {
        const op = mocWrapper.interface.encodeFunctionData("redeemTC", [asset.address, pEth("2"), pEth("1")]);
        await expectRevertReentrancyGuard(reentrancyAttacker.forward(mocWrapper.address, op));
      });
    });

    describe("WHEN a reentracy attacker contract reentrants mintTP", function () {
      it("THEN tx fails because there is a reentrant call", async function () {
        const op = mocWrapper.interface.encodeFunctionData("mintTP", [asset.address, tps[0], pEth(1), pEth(10)]);
        await expectRevertReentrancyGuard(reentrancyAttacker.forward(mocWrapper.address, op));
      });
    });

    describe("WHEN a reentracy attacker contract reentrants redeemTP", function () {
      it("THEN tx fails because there is a reentrant call", async function () {
        const op = mocWrapper.interface.encodeFunctionData("redeemTP", [asset.address, tps[0], 1000, 0]);
        await expectRevertReentrancyGuard(reentrancyAttacker.forward(mocWrapper.address, op));
      });
    });

    describe("WHEN a reentracy attacker contract reentrants swapTPforTP", function () {
      it("THEN tx fails because there is a reentrant call", async function () {
        //const tp1 = mocPeggedTokens[1].address;
        const op = mocWrapper.interface.encodeFunctionData("swapTPforTP", [
          asset.address,
          tps[0],
          tps[1],
          100,
          0,
          1000,
        ]);
        await expectRevertReentrancyGuard(reentrancyAttacker.forward(mocWrapper.address, op));
      });
    });

    describe("WHEN a reentracy attacker contract reentrants swapTPforTC", function () {
      it("THEN tx fails because there is a reentrant call", async function () {
        const op = mocWrapper.interface.encodeFunctionData("swapTPforTC", [asset.address, tps[0], 100, 0, 1000]);
        await expectRevertReentrancyGuard(reentrancyAttacker.forward(mocWrapper.address, op));
      });
    });

    describe("WHEN a reentracy attacker contract reentrants swapTCforTP", function () {
      it("THEN tx fails because there is a reentrant call", async function () {
        const op = mocWrapper.interface.encodeFunctionData("swapTCforTP", [asset.address, tps[0], 100, 0, 1000]);
        await expectRevertReentrancyGuard(reentrancyAttacker.forward(mocWrapper.address, op));
      });
    });

    describe("WHEN a reentracy attacker contract reentrants redeemTCandTP", function () {
      it("THEN tx fails because there is a reentrant call", async function () {
        const op = mocWrapper.interface.encodeFunctionData("redeemTCandTP", [
          asset.address,
          tps[0],
          pEth(2),
          pEth(2),
          pEth(1),
        ]);
        await expectRevertReentrancyGuard(reentrancyAttacker.forward(mocWrapper.address, op));
      });
    });

    describe("WHEN a reentracy attacker contract reentrants mintTCandTP", function () {
      it("THEN tx fails because there is a reentrant call", async function () {
        const op = mocWrapper.interface.encodeFunctionData("mintTCandTP", [asset.address, tps[0], pEth(1), pEth(10)]);
        await expectRevertReentrancyGuard(reentrancyAttacker.forward(mocWrapper.address, op));
      });
    });
  });
});
