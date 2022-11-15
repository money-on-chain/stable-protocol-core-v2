import { expect } from "chai";
import { getNamedAccounts } from "hardhat";
import { Address } from "hardhat-deploy/types";
import { ContractTransaction } from "ethers";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { mintTCandTPBehavior } from "../behaviors/mintTCandTP.behavior";
import { deployAsset, ERRORS, tpParams, pEth } from "../helpers/utils";
import { ERC20Mock, MocCAWrapper } from "../../typechain";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag redeem TC and TP", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      ({ alice, bob } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCABag(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCARBag(this.mocContracts);
      mocFunctions = this.mocFunctions;
      ({
        assets: [assetDefault],
        mocWrapper,
      } = this.mocContracts);
    });
    mintTCandTPBehavior();

    describe("WHEN mints TC and TP using an asset not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because asset is invalid", async () => {
        await expect(
          mocWrapper.redeemTCandTP(assetNotWhitelisted.address, TP_0, 10, 10, 10),
        ).to.be.revertedWithCustomError(mocWrapper, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN alice mints 23500 TP 0", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        tx = await mocFunctions.mintTCandTP({ i: TP_0, from: alice, qTP: 23500 });
      });
      it("THEN a TCandTPMintedWithWrapper event is emitted by MocWrapper", async function () {
        // asset: assetDefault
        // i: 0
        // sender: alice
        // receiver: alice
        // qTC: 300 TC
        // qTP: 23500 TP
        // qAC: 300 AC + 100 AC + 8% for Moc Fee Flow
        await expect(tx)
          .to.emit(mocWrapper, "TCandTPMintedWithWrapper")
          .withArgs(assetDefault.address, TP_0, alice, alice, pEth(300), pEth(23500), pEth(432));
      });
    });
    describe("WHEN alice mints 23500 TP 0 to bob", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        tx = await mocFunctions.mintTCandTPto({ i: TP_0, from: alice, to: bob, qTP: 23500 });
      });
      it("THEN a TCandTPMintedWithWrapper event is emitted by MocWrapper", async function () {
        // asset: assetDefault
        // i: 0
        // sender: alice
        // receiver: bob
        // qTC: 300 TC
        // qTP: 23500 TP
        // qAC: 300 AC + 100 AC + 8% for Moc Fee Flow
        await expect(tx)
          .to.emit(mocWrapper, "TCandTPMintedWithWrapper")
          .withArgs(assetDefault.address, TP_0, alice, bob, pEth(300), pEth(23500), pEth(432));
      });
    });
  });
});
