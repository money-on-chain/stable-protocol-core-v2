import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { ERC20Mock, MocCAWrapper } from "../../typechain";
import { mocFunctionsCABag } from "../helpers/mocFunctionsCABag";
import { swapTPforTCBehavior } from "../behaviors/swapTPforTC.behavior";
import { ERRORS, deployAsset, pEth, tpParams } from "../helpers/utils";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag swap TP for TC", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  let tp0: Address;
  const TP_0 = 0;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      ({ deployer, alice, bob } = await getNamedAccounts());
      this.mocContracts = await fixtureDeployedMocCABag(tpParams.length, tpParams)();
      this.mocFunctions = await mocFunctionsCABag(this.mocContracts);
      mocFunctions = this.mocFunctions;
      ({
        assets: [assetDefault],
        mocWrapper,
      } = this.mocContracts);
      tp0 = this.mocContracts.mocPeggedTokens[TP_0].address;
    });
    swapTPforTCBehavior();

    describe("WHEN swap TP for TC using an asset not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because asset is invalid", async () => {
        await expect(mocWrapper.swapTPforTC(assetNotWhitelisted.address, tp0, 10, 0, 10)).to.be.revertedWithCustomError(
          mocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("AND alice has 23500 TP 0", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        // add collateral
        await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
        // mint TP to alice
        await mocFunctions.mintTP({ from: alice, qTP: 23500 });
      });
      describe("WHEN alice swap 2350 TP 0 for TC", () => {
        beforeEach(async () => {
          tx = await mocFunctions.swapTPforTC({ from: alice, qTP: 2350 });
        });
        it("THEN a TPSwappedForTCWithWrapper event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // i: 0
          // sender: alice
          // receiver: alice
          // qTP: 2350 TP
          // qTC: 10 TC
          // qAC: 1% for fee of 10 AC
          await expect(tx)
            .to.emit(mocWrapper, "TPSwappedForTCWithWrapper")
            .withArgs(assetDefault.address, tp0, alice, alice, pEth(2350), pEth(10), pEth(0.1));
        });
      });
      describe("WHEN alice swap 2350 TP 0 for TC to bob", () => {
        beforeEach(async () => {
          tx = await mocFunctions.swapTPforTCto({ from: alice, to: bob, qTP: 2350 });
        });
        it("THEN a TPSwappedForTCWithWrapper event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // i: 0
          // sender: alice
          // receiver: bob
          // qTP: 2350 TP
          // qTC: 10 TC
          // qAC: 1% for fee of 10 AC
          await expect(tx)
            .to.emit(mocWrapper, "TPSwappedForTCWithWrapper")
            .withArgs(assetDefault.address, tp0, alice, bob, pEth(2350), pEth(10), pEth(0.1));
        });
      });
    });
  });
});
