// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";
import { mine } from "@nomicfoundation/hardhat-network-helpers";

const mintTC =
  mocImpl =>
  async ({ from, qTC, qACmax = qTC * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    return mocImpl.connect(signer).mintTC(qTC, { value: qACmax, gasPrice: 0 });
  };

const mintTCto =
  mocImpl =>
  async ({ from, to, qTC, qACmax = qTC * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    return mocImpl.connect(signer).mintTCto(qTC, to, { value: qACmax, gasPrice: 0 });
  };

const redeemTC =
  mocImpl =>
  async ({ from, qTC, qACmin = 0, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    return mocImpl.connect(signer).redeemTC(qTC, qACmin, { gasPrice: 0 });
  };

const redeemTCto =
  mocImpl =>
  async ({ from, to, qTC, qACmin = 0, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    return mocImpl.connect(signer).redeemTCto(qTC, qACmin, to, { gasPrice: 0 });
  };

const mintTP =
  mocImpl =>
  async ({ i, from, qTP, qACmax = qTP * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    return mocImpl.connect(signer).mintTP(i, qTP, { value: qACmax, gasPrice: 0 });
  };

const mintTPto =
  mocImpl =>
  async ({ i, from, to, qTP, qACmax = qTP * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    return mocImpl.connect(signer).mintTPto(i, qTP, to, { value: qACmax, gasPrice: 0 });
  };

const redeemTP =
  mocImpl =>
  async ({ i, from, qTP, qACmin = 0, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    // mine 1 so that it consumes the same number of blocks as collateralBag and makes the interest payment maths easier
    await mine(1);
    return mocImpl.connect(signer).redeemTP(i, qTP, qACmin, { gasPrice: 0 });
  };

const redeemTPto =
  mocImpl =>
  async ({ i, from, to, qTP, qACmin = 0, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    // mine 1 so that it consumes the same number of blocks as collateralBag and makes the interest payment maths easier
    await mine(1);
    return mocImpl.connect(signer).redeemTPto(i, qTP, qACmin, to, { gasPrice: 0 });
  };

const liqRedeemTP =
  mocImpl =>
  async ({ i, from }) => {
    const signer = await ethers.getSigner(from);
    return mocImpl.connect(signer).liqRedeemTP(i, { gasPrice: 0 });
  };

const liqRedeemTPto =
  mocImpl =>
  async ({ i, from, to }) => {
    const signer = await ethers.getSigner(from);
    return mocImpl.connect(signer).liqRedeemTPto(i, to, { gasPrice: 0 });
  };

const ethersGetBalance = () => account => ethers.provider.getBalance(account);

const tcBalanceOf = mocCollateralToken => async account => mocCollateralToken.balanceOf(account);
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

export const mocFunctionsCoinbase = async ({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders }) => {
  return {
    mintTC: mintTC(mocImpl),
    mintTCto: mintTCto(mocImpl),
    redeemTC: redeemTC(mocImpl),
    redeemTCto: redeemTCto(mocImpl),
    mintTP: mintTP(mocImpl),
    mintTPto: mintTPto(mocImpl),
    redeemTP: redeemTP(mocImpl),
    redeemTPto: redeemTPto(mocImpl),
    liqRedeemTP: liqRedeemTP(mocImpl),
    liqRedeemTPto: liqRedeemTPto(mocImpl),
    assetBalanceOf: ethersGetBalance(),
    acBalanceOf: ethersGetBalance(),
    tcBalanceOf: tcBalanceOf(mocCollateralToken),
    tcTransfer: tcTransfer(mocCollateralToken),
    tpBalanceOf: tpBalanceOf(mocPeggedTokens),
    tpTransfer: tpTransfer(mocPeggedTokens),
    pokePrice: pokePrice(priceProviders),
  };
};
