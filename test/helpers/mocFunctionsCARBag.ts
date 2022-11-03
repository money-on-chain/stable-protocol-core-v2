// @ts-nocheck
import { ethers } from "hardhat";
import { GAS_LIMIT_PATCH, pEth } from "./utils";

const mintTC =
  (mocWrapper, assetDefault) =>
  async ({ from, qTC, qACmax = qTC * 10, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
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
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
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
    await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
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
    await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
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
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
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
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    return mocWrapper.connect(signer).mintTPto(asset.address, i, qTP, qACmax, to);
  };

const redeemTP =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({ i, from, qTP, qACmin = 0, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    if (mocPeggedTokens[i]) {
      await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, qTP);
    }
    return mocWrapper.connect(signer).redeemTP(asset.address, i, qTP, qACmin);
  };

const redeemTPto =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({ i, from, to, qTP, qACmin = 0, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    if (mocPeggedTokens[i]) {
      await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, qTP);
    }
    return mocWrapper.connect(signer).redeemTPto(asset.address, i, qTP, qACmin, to);
  };

const liqRedeemTP =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({ i, from, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);

    await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, pEth(1e10));
    return mocWrapper.connect(signer).liqRedeemTP(asset.address, i, { gasLimit: GAS_LIMIT_PATCH });
  };

const liqRedeemTPto =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({ i, from, to, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, pEth(1e10));
    return mocWrapper.connect(signer).liqRedeemTPto(asset.address, i, to, { gasLimit: GAS_LIMIT_PATCH });
  };

const balanceOf =
  assetDefault =>
  (account, asset = assetDefault) =>
    asset.balanceOf(account);

const tpBalanceOf = mocPeggedTokens => async (i, account) => mocPeggedTokens[i].balanceOf(account);

// add an asset to the MocCABag whitelist with its respective price provider
const addOrEditAsset = mocWrapper => async (asset, priceProvider) => {
  return mocWrapper.addOrEditAsset(asset.address, priceProvider.address);
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

const tpTransfer =
  mocPeggedTokens =>
  async ({ i, from, to, amount, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      amount = pEth(amount);
    }
    return mocPeggedTokens[i].connect(signer).transfer(to, amount, { gasPrice: 0 });
  };

export const mocFunctionsCARBag = async ({
  mocWrapper,
  mocCollateralToken,
  assets,
  wcaToken,
  mocPeggedTokens,
  priceProviders,
}) => {
  return {
    mintTC: mintTC(mocWrapper, assets[0]),
    mintTCto: mintTCto(mocWrapper, assets[0]),
    redeemTC: redeemTC(mocWrapper, mocCollateralToken, assets[0]),
    redeemTCto: redeemTCto(mocWrapper, mocCollateralToken, assets[0]),
    mintTP: mintTP(mocWrapper, assets[0]),
    mintTPto: mintTPto(mocWrapper, assets[0]),
    redeemTP: redeemTP(mocWrapper, mocPeggedTokens, assets[0]),
    redeemTPto: redeemTPto(mocWrapper, mocPeggedTokens, assets[0]),
    liqRedeemTP: liqRedeemTP(mocWrapper, mocPeggedTokens, assets[0]),
    liqRedeemTPto: liqRedeemTPto(mocWrapper, mocPeggedTokens, assets[0]),
    assetBalanceOf: balanceOf(assets[0]),
    acBalanceOf: balanceOf(wcaToken),
    tcBalanceOf: balanceOf(mocCollateralToken),
    tcTransfer: tcTransfer(mocCollateralToken),
    tpBalanceOf: tpBalanceOf(mocPeggedTokens),
    tpTransfer: tpTransfer(mocPeggedTokens),
    addOrEditAsset: addOrEditAsset(mocWrapper),
    pokePrice: pokePrice(priceProviders),
  };
};
