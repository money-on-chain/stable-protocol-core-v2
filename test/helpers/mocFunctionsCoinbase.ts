// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";

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

export const mocFunctionsCoinbase = async mocContracts => {
  return {
    mintTC: mintTC(mocContracts.mocImpl),
    mintTCto: mintTCto(mocContracts.mocImpl),
    redeemTC: redeemTC(mocContracts.mocImpl),
    redeemTCto: redeemTCto(mocContracts.mocImpl),
    mintTP: mintTP(mocContracts.mocImpl),
    mintTPto: mintTPto(mocContracts.mocImpl),
    assetBalanceOf: ethersGetBalance(),
    acBalanceOf: ethersGetBalance(),
    tcBalanceOf: tcBalanceOf(mocContracts.mocCollateralToken),
    tcTransfer: tcTransfer(mocContracts.mocCollateralToken),
    tpBalanceOf: tpBalanceOf(mocContracts.mocPeggedTokens),
    pokePrice: pokePrice(mocContracts.priceProviders),
  };
};
