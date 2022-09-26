// @ts-nocheck
import { ethers } from "hardhat";
import { GAS_LIMIT_PATCH, pEth } from "./utils";

const mintTC =
  (mocImpl, collateralAsset) =>
  async ({ from, qTC, qACmax = qTC * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).approve(mocImpl.address, qACmax);
    return mocImpl.connect(signer).mintTC(qTC, qACmax);
  };

const mintTCto =
  (mocImpl, collateralAsset) =>
  async ({ from, to, qTC, qACmax = qTC * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).approve(mocImpl.address, qACmax);
    return mocImpl.connect(signer).mintTCto(qTC, qACmax, to);
  };

const redeemTC =
  (mocImpl, mocCollateralToken) =>
  async ({ from, qTC, qACmin = 0, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    await mocCollateralToken.connect(signer).approve(mocImpl.address, qTC);
    return mocImpl.connect(signer).redeemTC(qTC, qACmin);
  };

const redeemTCto =
  (mocImpl, mocCollateralToken) =>
  async ({ from, to, qTC, qACmin = 0, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    await mocCollateralToken.connect(signer).approve(mocImpl.address, qTC);
    return mocImpl.connect(signer).redeemTCto(qTC, qACmin, to);
  };

const mintTP =
  (mocImpl, collateralAsset) =>
  async ({ i, from, qTP, qACmax = qTP * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).approve(mocImpl.address, qACmax);
    return mocImpl.connect(signer).mintTP(i, qTP, qACmax);
  };

const mintTPto =
  (mocImpl, collateralAsset) =>
  async ({ i, from, to, qTP, qACmax = qTP * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).approve(mocImpl.address, qACmax);
    return mocImpl.connect(signer).mintTPto(i, qTP, qACmax, to);
  };

const redeemTP =
  mocImpl =>
  async ({ i, from, qTP, qACmin = 0, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    return mocImpl.connect(signer).redeemTP(i, qTP, qACmin);
  };

const redeemTPto =
  mocImpl =>
  async ({ i, from, to, qTP, qACmin = 0, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    return mocImpl.connect(signer).redeemTPto(i, qTP, qACmin, to);
  };

const liqRedeemTP =
  mocImpl =>
  async ({ i, from }) => {
    const signer = await ethers.getSigner(from);
    return mocImpl.connect(signer).liqRedeemTP(i, { gasLimit: GAS_LIMIT_PATCH });
  };

const liqRedeemTPto =
  mocImpl =>
  async ({ i, from, to }) => {
    const signer = await ethers.getSigner(from);
    return mocImpl.connect(signer).liqRedeemTPto(i, to, { gasLimit: GAS_LIMIT_PATCH });
  };
const balanceOf = asset => account => asset.balanceOf(account);
const tpBalanceOf = mocPeggedTokens => async (i, account) => mocPeggedTokens[i].balanceOf(account);
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

export const mocFunctionsRC20 = async ({
  mocImpl,
  collateralAsset,
  mocCollateralToken,
  mocPeggedTokens,
  priceProviders,
}) => ({
  mintTC: mintTC(mocImpl, collateralAsset),
  mintTCto: mintTCto(mocImpl, collateralAsset),
  redeemTC: redeemTC(mocImpl, mocCollateralToken),
  redeemTCto: redeemTCto(mocImpl, mocCollateralToken),
  mintTP: mintTP(mocImpl, collateralAsset),
  mintTPto: mintTPto(mocImpl, collateralAsset),
  redeemTP: redeemTP(mocImpl),
  redeemTPto: redeemTPto(mocImpl),
  liqRedeemTP: liqRedeemTP(mocImpl),
  liqRedeemTPto: liqRedeemTPto(mocImpl),
  assetBalanceOf: balanceOf(collateralAsset),
  acBalanceOf: balanceOf(collateralAsset),
  tcBalanceOf: balanceOf(mocCollateralToken),
  tcTransfer: tcTransfer(mocCollateralToken),
  tpBalanceOf: tpBalanceOf(mocPeggedTokens),
  tpTransfer: tpTransfer(mocPeggedTokens),
  pokePrice: pokePrice(priceProviders),
});
