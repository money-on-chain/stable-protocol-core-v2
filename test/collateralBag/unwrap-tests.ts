import { fixtureDeployedMocCABag } from "./fixture";
import { ERC20Mock, MocCAWrapper } from "../../typechain";
import { deployAsset, ERRORS, pEth } from "../helpers/utils";
import { expect } from "chai";
import { mocFunctionsCARBag } from "../helpers/mocFunctionsCARBag";
import { ethers, getNamedAccounts } from "hardhat";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/types";

describe("Feature: MocCAWrapper unwrap", function () {
  let mocWrapper: MocCAWrapper;
  let assets: ERC20Mock[];
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;
  let mocFeeFlow: Address;

  const fixtureDeploy = fixtureDeployedMocCABag(1, undefined, 2);

  describe("GIVEN mocFeeFlow has accumulated MocCAWrapper tokens", function () {
    beforeEach(async function () {
      ({ alice, bob, otherUser: mocFeeFlow } = await getNamedAccounts());

      const mocContracts = await fixtureDeploy();
      // Set custom feeFlow address so that it can receive the funds
      await mocContracts.mocImpl.setMocFeeFlowAddress(mocFeeFlow);

      mocFunctions = await mocFunctionsCARBag(mocContracts);
      ({ assets, mocWrapper } = mocContracts);

      await mocFunctions.mintTC({ from: alice, qTC: 1000, asset: assets[0] });
      await mocFunctions.mintTP({ i: 0, from: bob, qTP: 100, asset: assets[0] });
      await mocFunctions.mintTP({ i: 0, from: bob, qTP: 100, asset: assets[1] });
    });
    describe("WHEN tries to unwraps using an asset not whitelisted", () => {
      let assetNotWhitelisted: ERC20Mock;
      beforeEach(async () => {
        assetNotWhitelisted = await deployAsset();
      });
      it("THEN tx fails because asset is invalid", async () => {
        await expect(
          mocWrapper.unwrapToAsset(assetNotWhitelisted.address, pEth(61), pEth(61), mocFeeFlow),
        ).to.be.revertedWithCustomError(mocWrapper, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN mocFee address unwraps his tokens", () => {
      it("THEN it receives the corresponding assets values", async () => {
        // 1200 * 0.05 = 60
        await assertPrec(60, await mocFunctions.acBalanceOf(mocFeeFlow));
        await mocWrapper
          .connect(await ethers.provider.getSigner(mocFeeFlow))
          .unwrapToAsset(assets[0].address, pEth(30), pEth(30), mocFeeFlow);
        await mocWrapper
          .connect(await ethers.provider.getSigner(mocFeeFlow))
          .unwrapToAsset(assets[1].address, pEth(20), pEth(20), mocFeeFlow);

        await assertPrec(10, await mocFunctions.acBalanceOf(mocFeeFlow));
        await assertPrec(30, await assets[0].balanceOf(mocFeeFlow));
        await assertPrec(20, await assets[1].balanceOf(mocFeeFlow));
      });
    });
    describe("WHEN mocFee address expects to unwraps more than what corresponds", () => {
      it("THEN it fails", async () => {
        await expect(
          mocWrapper
            .connect(await ethers.provider.getSigner(mocFeeFlow))
            .unwrapToAsset(assets[0].address, pEth(60), pEth(61), mocFeeFlow),
        ).to.be.revertedWithCustomError(mocWrapper, ERRORS.QAC_BELOW_MINIMUM);
      });
    });
    describe("WHEN mocFee address tries to unwraps more than what he has", () => {
      it("THEN it fails", async () => {
        await expect(
          mocWrapper
            .connect(await ethers.provider.getSigner(mocFeeFlow))
            .unwrapToAsset(assets[0].address, pEth(61), pEth(61), mocFeeFlow),
        ).to.revertedWith("ERC20: burn amount exceeds balance");
      });
    });
    describe("AND there is not enough balance of a given asset", () => {
      describe("WHEN mocFee address tries to unwraps to it", () => {
        it("THEN it fails", async () => {
          // as Bob withdraws his TP to asset_1, there is no more asset_1 on the bag
          await mocFunctions.redeemTP({ i: 0, from: bob, qTP: 100, asset: assets[1] });
          await expect(
            mocWrapper
              .connect(await ethers.provider.getSigner(mocFeeFlow))
              .unwrapToAsset(assets[1].address, pEth(30), pEth(30), mocFeeFlow),
          ).to.revertedWith("ERC20: transfer amount exceeds balance");
        });
      });
    });
  });
});
