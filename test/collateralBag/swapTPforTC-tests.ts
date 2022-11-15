import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { ERC20Mock, MocCAWrapper } from "../../typechain";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { swapTPforTCBehavior } from "../behaviors/swapTPforTC.behavior";
import { ERRORS, deployAsset, mineUpTo, pEth, tpParams } from "../helpers/utils";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag swap TP for TC", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      ({ deployer, alice, bob } = await getNamedAccounts());
      this.mocContracts = await fixtureDeployedMocCABag(tpParams.length, tpParams)();
      this.mocFunctions = await mocFunctionsCARBag(this.mocContracts);
      mocFunctions = this.mocFunctions;
      ({
        assets: [assetDefault],
        mocWrapper,
      } = this.mocContracts);
    });
    swapTPforTCBehavior();

    describe("WHEN swap TP using an asset not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because asset is invalid", async () => {
        await expect(
          mocWrapper.swapTPforTP(assetNotWhitelisted.address, 0, 1, 10, 0, 10),
        ).to.be.revertedWithCustomError(mocWrapper, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("AND alice has 23500 TP 0", () => {
      let tx: ContractTransaction;
      const fixedBlock = 100;
      beforeEach(async () => {
        // add collateral
        await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
        // mint TP to alice
        await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500 });
        // go forward to a fixed block remaining for settlement to avoid unpredictability
        await mineUpTo(fixedBlock);
      });
      describe("WHEN alice swap 2350 TP 0 for TC", () => {
        beforeEach(async () => {
          tx = await mocFunctions.swapTPforTC({ i: TP_0, from: alice, qTP: 2350 });
        });
        it("THEN a TPSwappedForTC event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // i: 0
          // sender: alice
          // receiver: alice
          // qTP: 2350 TP
          // qTC: 10 TC
          // qAC: 1% for fee + 0.099% for interest of 100 AC
          await expect(tx)
            .to.emit(mocWrapper, "TPSwappedForTC")
            .withArgs(assetDefault.address, TP_0, alice, alice, pEth(2350), pEth(10), pEth("0.109991087962962960"));
        });
      });
      describe("WHEN alice swap 2350 TP 0 for TC to bob", () => {
        beforeEach(async () => {
          tx = await mocFunctions.swapTPforTCto({ i: TP_0, from: alice, to: bob, qTP: 2350 });
        });
        it("THEN a TPSwappedForTC event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // i: 0
          // sender: alice
          // receiver: bob
          // qTP: 2350 TP
          // qTC: 10 TC
          // qAC: 1% for fee + 0.099% for interest of 100 AC
          await expect(tx)
            .to.emit(mocWrapper, "TPSwappedForTC")
            .withArgs(assetDefault.address, TP_0, alice, bob, pEth(2350), pEth(10), pEth("0.109991087962962960"));
        });
      });
    });
  });
});
