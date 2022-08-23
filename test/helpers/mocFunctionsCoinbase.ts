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
    return mocCore.connect(signer).mintTC(qTC, { value: qACmax });
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
    acBalanceOf: acBalanceOf(),
    tcBalanceOf: tcBalanceOf(mocContracts.mocCollateralToken),
  };
};
