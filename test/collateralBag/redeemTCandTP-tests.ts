import { fixtureDeployedMocCABag } from "./fixture";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { redeemTCandTPBehavior } from "../behaviors/redeemTCandTP.behavior";
import { deployAsset, ERRORS, pEth, tpParams } from "../helpers/utils";
import { expect } from "chai";
import { ERC20Mock, MocCAWrapper, PriceProviderMock } from "../../typechain";
import { getNamedAccounts } from "hardhat";
import { Address } from "hardhat-deploy/types";
import { ContractTransaction } from "ethers";

describe("Feature: MocCABag redeem TC and TP", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let assetPriceProvider: PriceProviderMock;
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
        assetPriceProviders: [assetPriceProvider],
      } = this.mocContracts);
    });
    redeemTCandTPBehavior();

    describe("WHEN redeem TC and TP using an asset not whitelisted", () => {
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

    describe("AND alice has 3000 TC and 23500 TP 0 with asset price at 1:1", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        await mocFunctions.mintTC({ from: alice, qTC: 3000 });
        await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500 });
      });
      describe("WHEN alice redeems 100 TC and 783.33 TP 0", () => {
        beforeEach(async () => {
          tx = await mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500 });
        });
        it("THEN a TCandTPRedeemed event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // i: 0
          // sender: alice
          // receiver: alice
          // qTC: 100 TC
          // qTP: 783.33 TP
          // qAC: 100 AC - 5% + 3.33AC - 5% - 0.0987%
          await expect(tx)
            .to.emit(mocWrapper, "TCandTPRedeemed")
            .withArgs(
              assetDefault.address,
              TP_0,
              alice,
              alice,
              pEth(100),
              pEth("783.333333333333333333"),
              pEth("98.163334760802469138"),
            );
        });
      });
      describe("WHEN alice redeems 100 TC and 783.33 TP 0 to bob", () => {
        beforeEach(async () => {
          tx = await mocFunctions.redeemTCandTPto({ i: TP_0, from: alice, to: bob, qTC: 100, qTP: 23500 });
        });
        it("THEN a TCRedeemed event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // i: 0
          // sender: alice
          // receiver: bob
          // qTC: 100 TC
          // qTP: 783.33 TP
          // qAC: 100 AC - 5% + 3.33AC - 5% - 0.0987%
          await expect(tx)
            .to.emit(mocWrapper, "TCandTPRedeemed")
            .withArgs(
              assetDefault.address,
              TP_0,
              alice,
              bob,
              pEth(100),
              pEth("783.333333333333333333"),
              pEth("98.163334760802469138"),
            );
        });
      });
      describe("AND asset price provider is deprecated", () => {
        beforeEach(async () => {
          await assetPriceProvider.deprecatePriceProvider();
        });
        describe("WHEN alice redeems 100 TC and 783.33 TP 0", () => {
          it("THEN tx fails because invalid price provider", async () => {
            await expect(
              mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 100, qTP: 23500 }),
            ).to.be.revertedWithCustomError(mocWrapper, ERRORS.INVALID_PRICE_PROVIDER);
          });
        });
      });
    });
  });
});
