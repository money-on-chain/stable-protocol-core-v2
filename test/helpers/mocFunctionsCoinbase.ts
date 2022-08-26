// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";

const mintTC =
  mocCore =>
  async (from, qTC, qACmax = qTC * 10, applyPresicion = true) => {
    const signer = await ethers.getSigner(from);
    if (applyPresicion) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    return mocCore.connect(signer).mintTC(qTC, { value: qACmax, gasPrice: 0 });
  };

const mintTCto =
  mocCore =>
  async (from, to, qTC, qACmax = qTC * 10, applyPresicion = true) => {
    const signer = await ethers.getSigner(from);
    if (applyPresicion) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    return mocCore.connect(signer).mintTCto(qTC, to, { value: qACmax, gasPrice: 0 });
  };

const assetBalanceOf = () => account => {
  return ethers.provider.getBalance(account);
};

const acBalanceOf = () => account => {
  return ethers.provider.getBalance(account);
};

const tcBalanceOf = mocCollateralToken => async account => {
  return mocCollateralToken.balanceOf(account);
};

export const mocFunctionsCoinbase = async mocContracts => {
  return {
    mintTC: mintTC(mocContracts.mocCore),
    mintTCto: mintTCto(mocContracts.mocCore),
    assetBalanceOf: assetBalanceOf(),
    acBalanceOf: acBalanceOf(),
    tcBalanceOf: tcBalanceOf(mocContracts.mocCollateralToken),
  };
};
