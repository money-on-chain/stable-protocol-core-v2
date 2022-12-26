import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { ContractTransaction } from "ethers";
import { ERC20Mock, MocCAWrapper, PriceProviderMock } from "../../typechain";
import { mocFunctionsCABag } from "../helpers/mocFunctionsCABag";
import { swapTPforTPBehavior } from "../behaviors/swapTPforTP.behavior";
import { ERRORS, deployAsset, pEth, tpParams } from "../helpers/utils";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag swap TP for TP", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let assetPriceProvider: PriceProviderMock;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;
  const TP_1 = 1;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      ({ deployer, alice, bob } = await getNamedAccounts());
      this.mocContracts = await fixtureDeployedMocCABag(tpParams.length, tpParams)();
      this.mocFunctions = await mocFunctionsCABag(this.mocContracts);
      mocFunctions = this.mocFunctions;
      ({
        assets: [assetDefault],
        mocWrapper,
        assetPriceProviders: [assetPriceProvider],
      } = this.mocContracts);
    });
    swapTPforTPBehavior();

    describe("WHEN swap TP for TP using an asset not whitelisted", () => {
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
      beforeEach(async () => {
        // add collateral
        await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
        // mint TP to alice
        await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500 });
      });
      describe("WHEN alice swap 2350 TP 0 for TP 1", () => {
        beforeEach(async () => {
          tx = await mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 2350 });
        });
        it("THEN a TPSwappedForTPWithWrapper event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // iFrom: 0
          // iTo: 1
          // sender: alice
          // receiver: alice
          // qTPfrom: 2350 TP
          // qTPto: 52.5
          // qAC: 1% for fee of 10 AC
          await expect(tx)
            .to.emit(mocWrapper, "TPSwappedForTPWithWrapper")
            .withArgs(assetDefault.address, TP_0, TP_1, alice, alice, pEth(2350), pEth(52.5), pEth(0.1));
        });
      });
      describe("WHEN alice swap 2350 TP 0 for TP 1 to bob", () => {
        beforeEach(async () => {
          tx = await mocFunctions.swapTPforTPto({ iFrom: TP_0, iTo: TP_1, from: alice, to: bob, qTP: 2350 });
        });
        it("THEN a TPSwappedForTPWithWrapper event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // iFrom: 0
          // iTo: 1
          // sender: alice
          // receiver: bob
          // qTPfrom: 2350 TP
          // qTPto: 52.5
          // qAC: 1% for fee of 10 AC
          await expect(tx)
            .to.emit(mocWrapper, "TPSwappedForTPWithWrapper")
            .withArgs(assetDefault.address, TP_0, TP_1, alice, bob, pEth(2350), pEth(52.5), pEth(0.1));
        });
      });
      describe("AND asset price provider is deprecated", () => {
        beforeEach(async () => {
          await assetPriceProvider.deprecatePriceProvider();
        });
        describe("WHEN alice tries to swap 2350 TP 0 for TP 1", () => {
          it("THEN tx fails because invalid price provider", async () => {
            await expect(
              mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 2350 }),
            ).to.be.revertedWithCustomError(mocWrapper, ERRORS.MISSING_PROVIDER_PRICE);
          });
        });
      });
    });
  });
});
