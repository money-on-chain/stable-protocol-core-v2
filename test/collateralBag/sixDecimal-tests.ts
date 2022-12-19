import { BigNumber } from "@ethersproject/bignumber";
import { Address } from "hardhat-deploy/types";
import { expect } from "chai";
import { ethers, getNamedAccounts } from "hardhat";
import { ERC20Mock, MocCAWrapper, MocTC } from "../../typechain";
import { Balance, deployAsset, deployPriceProvider, pEth } from "../helpers/utils";
import { assertPrec } from "../helpers/assertHelper";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCAWrapper with six decimal based asset", function () {
  let mocWrapper: MocCAWrapper;
  let mocCollateralToken: MocTC;
  let USDC: ERC20Mock;
  let alice: Address;
  let mocFeeFlow: Address;
  let usdcBalanceBefore: Balance;
  let tcBalanceBefore: Balance;

  const fixtureDeploy = fixtureDeployedMocCABag(1, undefined, 1);

  describe("GIVEN there is a MocWrapper with asset of 6 decimals", function () {
    beforeEach(async function () {
      ({ alice, otherUser: mocFeeFlow } = await getNamedAccounts());

      const mocContracts = await fixtureDeploy();
      ({ mocWrapper, mocCollateralToken } = mocContracts);
      await mocContracts.mocImpl.setMocFeeFlowAddress(mocFeeFlow);

      const shifterFactory = await ethers.getContractFactory("PriceProviderShifter");

      USDC = await deployAsset();
      await USDC.setDecimals(6);
      // Both assets has the same price (= 1)
      const priceProviderUSDC = await deployPriceProvider(pEth(1));
      // We need to shift this price provider value 12 places, to get to 18 parity
      const shiftedPriceProviderUSDC = await shifterFactory.deploy(priceProviderUSDC.address, await USDC.decimals());
      await mocWrapper.addOrEditAsset(USDC.address, shiftedPriceProviderUSDC.address, await USDC.decimals());
    });
    describe("WHEN minting 1 wei TC", () => {
      const qTC = 1;
      beforeEach(async function () {
        const signer = await ethers.getSigner(alice);
        usdcBalanceBefore = await USDC.balanceOf(alice);
        // 1.05 in this Asset, are 1.05 * 10^6
        const qUSDmax = BigNumber.from(1e4).mul(105); //1.050000
        await USDC.connect(signer).increaseAllowance(mocWrapper.address, qUSDmax);
        await mocWrapper.connect(signer).mintTC(USDC.address, qTC, qUSDmax);
      });
      it("THEN receives 1 wei TC", async () => {
        expect(await mocCollateralToken.balanceOf(alice)).to.be.equal(qTC);
      });
      it("THEN spends 1 micro USDC", async () => {
        const usdcBalanceActual = await USDC.balanceOf(alice);
        const diff = usdcBalanceBefore.sub(usdcBalanceActual);
        assertPrec("0.000000000000000001", diff);
      });
      it("THEN wrapped Token price is still 1", async () => {
        expect(await mocWrapper.getTokenPrice()).to.be.equal(pEth(1));
      });
    });
    describe("WHEN minting 10e7 wei TC", () => {
      const qTC = pEth("0.0000001");
      beforeEach(async function () {
        const signer = await ethers.getSigner(alice);
        usdcBalanceBefore = await USDC.balanceOf(alice);
        // 1.05 in this Asset, are 1.05 * 10^6
        const qUSDmax = BigNumber.from(1e4).mul(105); //1.050000
        await USDC.connect(signer).increaseAllowance(mocWrapper.address, qUSDmax);
        await mocWrapper.connect(signer).mintTC(USDC.address, qTC, qUSDmax);
      });
      it("THEN receives 10e7 wei TC", async () => {
        expect(await mocCollateralToken.balanceOf(alice)).to.be.equal(qTC);
      });
      it("THEN spends 1 micro USDC", async () => {
        const usdcBalanceActual = await USDC.balanceOf(alice);
        const diff = usdcBalanceBefore.sub(usdcBalanceActual);
        assertPrec("0.000000000000000001", diff);
      });
      it("THEN wrapped Token price is still 1", async () => {
        expect(await mocWrapper.getTokenPrice()).to.be.equal(pEth(1));
      });
    });
    describe("WHEN minting 10e6 wei TC", () => {
      const qTC = pEth("0.000001");
      beforeEach(async function () {
        const signer = await ethers.getSigner(alice);
        usdcBalanceBefore = await USDC.balanceOf(alice);
        // 1.05 in this Asset, are 1.05 * 10^6
        const qUSDmax = BigNumber.from(1e4).mul(105); //1.050000
        await USDC.connect(signer).increaseAllowance(mocWrapper.address, qUSDmax);
        await mocWrapper.connect(signer).mintTC(USDC.address, qTC, qUSDmax);
      });
      it("THEN receives 10e6 wei TC", async () => {
        expect(await mocCollateralToken.balanceOf(alice)).to.be.equal(qTC);
      });
      it("THEN spends 2 micro USDC", async () => {
        const usdcBalanceActual = await USDC.balanceOf(alice);
        const diff = usdcBalanceBefore.sub(usdcBalanceActual);
        assertPrec("0.000000000000000002", diff);
      });
      it("THEN wrapped Token price is still 1", async () => {
        expect(await mocWrapper.getTokenPrice()).to.be.equal(pEth(1));
      });
    });
    describe("AND mints 1000 TC", () => {
      const qTC = pEth(1000);
      beforeEach(async function () {
        const signer = await ethers.getSigner(alice);
        usdcBalanceBefore = await USDC.balanceOf(alice);
        // 1050 in this Asset, are 1050 * 10^6
        const qUSDmax = BigNumber.from(1e7).mul(105); //1050.000000
        await USDC.connect(signer).increaseAllowance(mocWrapper.address, qUSDmax);
        await mocWrapper.connect(signer).mintTC(USDC.address, qTC, qUSDmax);
      });
      it("THEN receives 1000 TC", async () => {
        expect(await mocCollateralToken.balanceOf(alice)).to.be.equal(qTC);
      });
      it("THEN spends 1050 USDC", async () => {
        const usdcBalanceActual = await USDC.balanceOf(alice);
        const diff = usdcBalanceBefore.sub(usdcBalanceActual);
        assertPrec(BigNumber.from(1e7).mul(105), diff);
      });
      it("THEN wrapped Token price is still 1", async () => {
        expect(await mocWrapper.getTokenPrice()).to.be.equal(pEth(1));
      });
      describe("WHEN redeems 1 wei TC", () => {
        const qTC = pEth("0.000000000000000001");
        beforeEach(async function () {
          const signer = await ethers.getSigner(alice);
          usdcBalanceBefore = await USDC.balanceOf(alice);
          tcBalanceBefore = await mocCollateralToken.balanceOf(alice);
          await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
          await mocWrapper.connect(signer).redeemTC(USDC.address, qTC, 0);
        });
        it("THEN spends 1 wei TC", async () => {
          const tcBalanceActual = await mocCollateralToken.balanceOf(alice);
          const diff = tcBalanceBefore.sub(tcBalanceActual);
          assertPrec(qTC, diff);
        });
        it("THEN receives 0 USDC", async () => {
          const usdcBalanceActual = await USDC.balanceOf(alice);
          const diff = usdcBalanceActual.sub(usdcBalanceBefore);
          assertPrec(0, diff);
        });
        it("THEN wrapped Token price is still 1", async () => {
          expect(await mocWrapper.getTokenPrice()).to.be.equal(pEth(1));
        });
      });
      describe("WHEN redeems 10e7 wei TC", () => {
        const qTC = pEth("0.0000001");
        beforeEach(async function () {
          const signer = await ethers.getSigner(alice);
          usdcBalanceBefore = await USDC.balanceOf(alice);
          tcBalanceBefore = await mocCollateralToken.balanceOf(alice);
          await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
          await mocWrapper.connect(signer).redeemTC(USDC.address, qTC, 0);
        });
        it("THEN spends 10e7 wei TC", async () => {
          const tcBalanceActual = await mocCollateralToken.balanceOf(alice);
          const diff = tcBalanceBefore.sub(tcBalanceActual);
          assertPrec(qTC, diff);
        });
        it("THEN receives 0 USDC", async () => {
          const usdcBalanceActual = await USDC.balanceOf(alice);
          const diff = usdcBalanceActual.sub(usdcBalanceBefore);
          assertPrec(0, diff);
        });
        it("THEN wrapped Token price is still 1", async () => {
          expect(await mocWrapper.getTokenPrice()).to.be.equal(pEth(1));
        });
      });
      describe("WHEN redeems 10e4 wei TC", () => {
        const qTC = pEth("0.0001");
        beforeEach(async function () {
          const signer = await ethers.getSigner(alice);
          usdcBalanceBefore = await USDC.balanceOf(alice);
          tcBalanceBefore = await mocCollateralToken.balanceOf(alice);
          await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
          await mocWrapper.connect(signer).redeemTC(USDC.address, qTC, 0);
        });
        it("THEN spends 10e4 wei TC", async () => {
          const tcBalanceActual = await mocCollateralToken.balanceOf(alice);
          const diff = tcBalanceBefore.sub(tcBalanceActual);
          assertPrec(qTC, diff);
        });
        it("THEN receives 95 micro USDC", async () => {
          const usdcBalanceActual = await USDC.balanceOf(alice);
          const diff = usdcBalanceActual.sub(usdcBalanceBefore);
          assertPrec("0.000000000000000095", diff);
        });
        it("THEN wrapped Token price is still 1", async () => {
          expect(await mocWrapper.getTokenPrice()).to.be.equal(pEth(1));
        });
      });
      describe("WHEN redeems 10 TC", () => {
        const qTC = pEth(10);
        beforeEach(async function () {
          const signer = await ethers.getSigner(alice);
          usdcBalanceBefore = await USDC.balanceOf(alice);
          tcBalanceBefore = await mocCollateralToken.balanceOf(alice);
          await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
          await mocWrapper.connect(signer).redeemTC(USDC.address, qTC, 0);
        });
        it("THEN spends 10 TC", async () => {
          const tcBalanceActual = await mocCollateralToken.balanceOf(alice);
          const diff = tcBalanceBefore.sub(tcBalanceActual);
          assertPrec(qTC, diff);
        });
        it("THEN receives 9.5 USDC", async () => {
          const usdcBalanceActual = await USDC.balanceOf(alice);
          const diff = usdcBalanceActual.sub(usdcBalanceBefore);
          assertPrec(BigNumber.from(1e5).mul(95), diff);
        });
        it("THEN wrapped Token price is still 1", async () => {
          expect(await mocWrapper.getTokenPrice()).to.be.equal(pEth(1));
        });
      });
    });
  });
});
