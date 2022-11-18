import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { ERC20Mock, MocCAWrapper } from "../../typechain";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { swapTCforTPBehavior } from "../behaviors/swapTCforTP.behavior";
import { ERRORS, deployAsset, pEth, tpParams } from "../helpers/utils";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag swap TC for TP", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      ({ alice, bob } = await getNamedAccounts());
      this.mocContracts = await fixtureDeployedMocCABag(tpParams.length, tpParams)();
      this.mocFunctions = await mocFunctionsCARBag(this.mocContracts);
      mocFunctions = this.mocFunctions;
      ({
        assets: [assetDefault],
        mocWrapper,
      } = this.mocContracts);
    });
    swapTCforTPBehavior();

    describe("WHEN swap TC for TP using an asset not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because asset is invalid", async () => {
        await expect(mocWrapper.swapTCforTP(assetNotWhitelisted.address, 0, 10, 0, 10)).to.be.revertedWithCustomError(
          mocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("AND alice has 3000 TC", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        // mint TC to alice
        await mocFunctions.mintTC({ i: TP_0, from: alice, qTC: 3000 });
      });
      describe("WHEN alice swap 10 TC for TP 0", () => {
        beforeEach(async () => {
          tx = await mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 10 });
        });
        it("THEN a TCSwappedForTPWithWrapper event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // i: 0
          // sender: alice
          // receiver: alice
          // qTC: 100 TC
          // qTP: 2350 TC
          // qAC: 1% for fee of 10 AC
          await expect(tx)
            .to.emit(mocWrapper, "TCSwappedForTPWithWrapper")
            .withArgs(assetDefault.address, TP_0, alice, alice, pEth(10), pEth(2350), pEth(0.1));
        });
      });
      describe("WHEN alice swap 10 TC for TP 0 to bob", () => {
        beforeEach(async () => {
          tx = await mocFunctions.swapTCforTPto({ i: TP_0, from: alice, to: bob, qTC: 10 });
        });
        it("THEN a TCSwappedForTPWithWrapper event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // i: 0
          // sender: alice
          // receiver: bob
          // qTC: 10 TC
          // qTC: 2350 TP
          // qAC: 1% for fee 10 AC
          await expect(tx)
            .to.emit(mocWrapper, "TCSwappedForTPWithWrapper")
            .withArgs(assetDefault.address, TP_0, alice, bob, pEth(10), pEth(2350), pEth(0.1));
        });
      });
    });
  });
});
