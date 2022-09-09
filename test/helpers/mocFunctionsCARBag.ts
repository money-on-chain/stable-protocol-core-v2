// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";

const mintTC =
  (mocWrapper, assetDefault) =>
  async ({ from, qTC, qACmax = qTC * 10, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).approve(mocWrapper.address, qACmax);
    return mocWrapper.connect(signer).mintTC(asset.address, qTC, qACmax);
  };

const mintTCto =
  (mocWrapper, assetDefault) =>
  async ({ from, to, qTC, qACmax = qTC * 10, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).approve(mocWrapper.address, qACmax);
    return mocWrapper.connect(signer).mintTCto(asset.address, qTC, qACmax, to);
  };

const redeemTC =
  (mocWrapper, mocCollateralToken, assetDefault) =>
  async ({ from, qTC, qACmin = 0, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    await mocCollateralToken.connect(signer).approve(mocWrapper.address, qTC);
    return mocWrapper.connect(signer).redeemTC(asset.address, qTC, qACmin);
  };

const redeemTCto =
  (mocWrapper, mocCollateralToken, assetDefault) =>
  async ({ from, to, qTC, qACmin = 0, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    await mocCollateralToken.connect(signer).approve(mocWrapper.address, qTC);
    return mocWrapper.connect(signer).redeemTCto(asset.address, qTC, qACmin, to);
  };

const mintTP =
  (mocWrapper, assetDefault) =>
  async ({ i, from, qTP, qACmax = qTP * 10, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).approve(mocWrapper.address, qACmax);
    return mocWrapper.connect(signer).mintTP(asset.address, i, qTP, qACmax);
  };

const mintTPto =
  (mocWrapper, assetDefault) =>
  async ({ i, from, to, qTP, qACmax = qTP * 10, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).approve(mocWrapper.address, qACmax);
    return mocWrapper.connect(signer).mintTPto(asset.address, i, qTP, qACmax, to);
  };

const balanceOf =
  assetDefault =>
  (account, asset = assetDefault) =>
    asset.balanceOf(account);

const tpBalanceOf = mocPeggedTokens => async (i, account) => mocPeggedTokens[i].balanceOf(account);

// add an asset to the MocCABag whitelist with its respective price provider
const addAsset = mocWrapper => async (asset, priceProvider) => {
  return mocWrapper.addAsset(asset.address, priceProvider.address);
};
const pokePrice = priceProviders => async (i, newPrice) => priceProviders[i].poke(pEth(newPrice));

const tcTransfer =
  mocCollateralToken =>
  async ({ from, to, amount, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      amount = pEth(amount);
    }
    return mocCollateralToken.connect(signer).transfer(to, amount, { gasPrice: 0 });
  };

export const mocFunctionsCARBag = async (mocContracts, assetDefault) => {
  return {
    mintTC: mintTC(mocContracts.mocWrapper, assetDefault),
    mintTCto: mintTCto(mocContracts.mocWrapper, assetDefault),
    redeemTC: redeemTC(mocContracts.mocWrapper, mocContracts.mocCollateralToken, assetDefault),
    redeemTCto: redeemTCto(mocContracts.mocWrapper, mocContracts.mocCollateralToken, assetDefault),
    mintTP: mintTP(mocContracts.mocWrapper, assetDefault),
    mintTPto: mintTPto(mocContracts.mocWrapper, assetDefault),
    assetBalanceOf: balanceOf(assetDefault),
    acBalanceOf: balanceOf(mocContracts.wcaToken),
    tcBalanceOf: balanceOf(mocContracts.mocCollateralToken),
    tcTransfer: tcTransfer(mocContracts.mocCollateralToken),
    tpBalanceOf: tpBalanceOf(mocContracts.mocPeggedTokens),
    addAsset: addAsset(mocContracts.mocWrapper),
    pokePrice: pokePrice(mocContracts.priceProviders),
  };
};
