import { fixtureDeployedMocCABag } from "./fixture";
import { ERC20Mock, MocCAWrapper, MocSettlement, PriceProviderMock } from "../../typechain";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { redeemTPBehavior } from "../behaviors/redeemTP.behavior";
import { Balance, deployAsset, deployPriceProvider, ERRORS, mineUpTo, pEth } from "../helpers/utils";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { getNamedAccounts } from "hardhat";
import { assertPrec } from "../helpers/assertHelper";
import { ContractTransaction } from "ethers";
import { tpParams } from "../helpers/utils";

describe("Feature: MocCABag redeem TP", function () {
  let mocWrapper: MocCAWrapper;
  let assetDefault: ERC20Mock;
  let mocSettlement: MocSettlement;
  let mocFunctions: any;
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  const TP_0 = 0;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      ({ deployer, alice, bob } = await getNamedAccounts());
      this.mocContracts = await fixtureDeployedMocCABag(tpParams.length, tpParams)();
      mocFunctions = await mocFunctionsCARBag(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({ assetDefault, mocWrapper, mocSettlement } = this.mocContracts);
    });
    redeemTPBehavior();

    describe("WHEN redeem TP using an asset not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because asset is invalid", async () => {
        await expect(mocWrapper.redeemTP(assetNotWhitelisted.address, 0, 10, 10)).to.be.revertedWithCustomError(
          mocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });

    describe("AND alice has 23500 TPs with asset price at 1:1", () => {
      let tx: ContractTransaction;
      const fixedBlock = 52;
      beforeEach(async () => {
        // add collateral
        await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
        // mint TP to alice
        await mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500 });
        // go forward to a fixed block remaining for settlement to avoid unpredictability
        await mineUpTo(fixedBlock);
      });
      describe("WHEN alice redeems 2350 TP", () => {
        beforeEach(async () => {
          tx = await mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: 2350 });
        });
        it("THEN a TPRedeemed event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // i: 0
          // sender: alice
          // receiver: alice
          // qTP: 2350 TP
          // qAC: 10AC - 5% for Moc Fee Flow - 0.1% for interest collector
          await expect(tx)
            .to.emit(mocWrapper, "TPRedeemed")
            .withArgs(assetDefault.address, TP_0, alice, alice, pEth(2350), pEth("9.49000393518518519"));
        });
      });

      describe("WHEN alice redeems 2350 TP to bob", () => {
        beforeEach(async () => {
          tx = await mocFunctions.redeemTPto({ i: TP_0, from: alice, to: bob, qTP: 2350 });
        });
        it("THEN a TPRedeemed event is emitted by MocWrapper", async function () {
          // asset: assetDefault
          // i: 0
          // sender: alice
          // receiver: bob
          // qTP: 2350 TP
          // qAC: 10AC - 5% for Moc Fee Flow - 0.1% for interest collector
          await expect(tx)
            .to.emit(mocWrapper, "TPRedeemed")
            .withArgs(assetDefault.address, TP_0, alice, bob, pEth(2350), pEth("9.49000393518518519"));
        });
      });
      let newAsset: ERC20Mock;
      let newPriceProvider: PriceProviderMock;
      describe("WHEN a new asset with price 0.9 is added", () => {
        beforeEach(async () => {
          newAsset = await deployAsset();
          newPriceProvider = await deployPriceProvider(pEth(0.9));
          await mocFunctions.addAsset(newAsset, newPriceProvider);
          // add stock of the new asset to the collateral bag
          await mocFunctions.mintTC({ from: deployer, qTC: 1000, asset: newAsset });
        });
        describe("AND redeem 23500 TP in exchange of the new asset", () => {
          let aliceNewAssetPrevBalance: Balance;
          beforeEach(async () => {
            aliceNewAssetPrevBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            // go forward to a fixed block remaining for settlement to avoid unpredictability in the interest rate
            const bns = await mocSettlement.bns();
            await mineUpTo(bns.sub(fixedBlock));
            await mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: 23500, asset: newAsset });
          });
          it("THEN alice receives 102.75 of the new asset instead of 92.45", async () => {
            //asset reward = 92.47 currency / 0.9 asset price
            const aliceNewAssetActualBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            const diff = aliceNewAssetActualBalance.sub(aliceNewAssetPrevBalance);
            assertPrec("102.756983024691358111", diff);
          });
        });
      });
      describe("WHEN add a new asset with price 1.1", () => {
        beforeEach(async () => {
          newAsset = await deployAsset();
          newPriceProvider = await deployPriceProvider(pEth(1.1));
          await mocFunctions.addAsset(newAsset, newPriceProvider);
          // add stock of the new asset to the collateral bag
          await mocFunctions.mintTC({ from: deployer, qTC: 1000, asset: newAsset });
        });
        describe("AND redeem 23500 TP with new asset", () => {
          let aliceNewAssetPrevBalance: Balance;
          beforeEach(async () => {
            aliceNewAssetPrevBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            // go forward to a fixed block remaining for settlement to avoid unpredictability in the interest rate
            const bns = await mocSettlement.bns();
            await mineUpTo(bns.sub(fixedBlock));
            await mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: 23500, asset: newAsset });
          });
          it("THEN alice receives 84.07 of the new asset instead of 92.45", async () => {
            //asset reward = 92.47 currency / 1.1 asset price
            const aliceNewAssetActualBalance = await mocFunctions.assetBalanceOf(alice, newAsset);
            const diff = aliceNewAssetActualBalance.sub(aliceNewAssetPrevBalance);
            assertPrec("84.073895202020202090", diff);
          });
        });
      });
    });
  });
});
