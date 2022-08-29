// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";

const mintTC =
  mocCore =>
  async ({ from, qTC, qACmax = qTC * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    return mocCore.connect(signer).mintTC(qTC, { value: qACmax, gasPrice: 0 });
  };

const mintTCto =
  mocCore =>
  async ({ from, to, qTC, qACmax = qTC * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    return mocCore.connect(signer).mintTCto(qTC, to, { value: qACmax, gasPrice: 0 });
  };

const ethersGetBalance = () => account => ethers.provider.getBalance(account);

const tcBalanceOf = mocCollateralToken => async account => mocCollateralToken.balanceOf(account);

export const mocFunctionsCoinbase = async mocContracts => {
  return {
    mintTC: mintTC(mocContracts.mocCore),
    mintTCto: mintTCto(mocContracts.mocCore),
    assetBalanceOf: ethersGetBalance(),
    acBalanceOf: ethersGetBalance(),
    tcBalanceOf: tcBalanceOf(mocContracts.mocCollateralToken),
  };
};
