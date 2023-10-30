import { expect } from "chai";
import { getNamedAccounts } from "hardhat";
import { Address } from "hardhat-deploy/types";
import { ContractTransaction } from "ethers";
import { mocFunctionsCABag } from "../helpers/mocFunctionsCABag";
import { mintTCandTPBehavior } from "../behaviors/mintTCandTP.behavior";
import { deployAsset, ERRORS, tpParams, pEth } from "../helpers/utils";
import { ERC20Mock, MocCAWrapper } from "../../typechain";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag mint TC and TP", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;
  let tp0: Address;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      ({ alice, bob } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCABag(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCABag(this.mocContracts);
      mocFunctions = this.mocFunctions;
      ({
        assets: [assetDefault],
        mocWrapper,
      } = this.mocContracts);
      tp0 = this.mocContracts.mocPeggedTokens[0].address;
    });
    mintTCandTPBehavior();

    describe("WHEN mints TC and TP using an asset not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because asset is invalid", async () => {
        await expect(mocWrapper.mintTCandTP(assetNotWhitelisted.address, tp0, 10, 10)).to.be.revertedWithCustomError(
          mocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("WHEN alice mints 23500 TP 0", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        tx = await mocFunctions.mintTCandTP({ from: alice, qTP: 23500 });
      });
      it("THEN a TCandTPMintedWithWrapper event is emitted by MocWrapper", async function () {
        // asset: assetDefault
        // i: 0
        // sender: alice
        // receiver: alice
        // qTC: 454.14 TC
        // qTP: 23500 TP
        // qAC: 454.14 AC + 100 AC + 8% for Moc Fee Flow
        await expect(tx)
          .to.emit(mocWrapper, "TCandTPMintedWithWrapper")
          .withArgs(
            assetDefault.address,
            tp0,
            alice,
            alice,
            pEth("454.140728164497264600"),
            pEth(23500),
            pEth("598.471986417657045768"),
          );
      });
    });
    describe("WHEN alice mints 23500 TP 0 to bob", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        tx = await mocFunctions.mintTCandTP({ from: alice, to: bob, qTP: 23500 });
      });
      it("THEN a TCandTPMintedWithWrapper event is emitted by MocWrapper", async function () {
        // asset: assetDefault
        // i: 0
        // sender: alice
        // receiver: bob
        // qTC: 454.14 TC
        // qTP: 23500 TP
        // qAC: 454.14 AC + 100 AC + 8% for Moc Fee Flow
        await expect(tx)
          .to.emit(mocWrapper, "TCandTPMintedWithWrapper")
          .withArgs(
            assetDefault.address,
            tp0,
            alice,
            bob,
            pEth("454.140728164497264600"),
            pEth(23500),
            pEth("598.471986417657045768"),
          );
      });
    });
  });
});
