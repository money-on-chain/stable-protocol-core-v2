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

export const mocFunctionsCoinbase = async mocContracts => {
  return {
    mintTC: mintTC(mocContracts.mocImpl),
    mintTCto: mintTCto(mocContracts.mocImpl),
    mintTP: mintTP(mocContracts.mocImpl),
    mintTPto: mintTPto(mocContracts.mocImpl),
    assetBalanceOf: ethersGetBalance(),
    acBalanceOf: ethersGetBalance(),
    tcBalanceOf: tcBalanceOf(mocContracts.mocCollateralToken),
    tpBalanceOf: tpBalanceOf(mocContracts.mocPeggedTokens),
  };
};
