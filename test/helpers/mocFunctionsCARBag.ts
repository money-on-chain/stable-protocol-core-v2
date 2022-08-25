// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";

const mintTC =
  (mocWrapper, asset) =>
  async (from, qTC, qACmax = qTC * 10, applyPresicion = true) => {
    const signer = await ethers.getSigner(from);
    if (applyPresicion) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).approve(mocWrapper.address, qACmax);
    return mocWrapper.connect(signer).mintTC(asset.address, qTC, qACmax);
  };

const mintTCto =
  (mocWrapper, asset) =>
  async (from, to, qTC, qACmax = qTC * 10, applyPresicion = true) => {
    const signer = await ethers.getSigner(from);
    if (applyPresicion) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).approve(mocWrapper.address, qACmax);
    return mocWrapper.connect(signer).mintTCto(asset.address, qTC, qACmax, to);
  };

const assetBalanceOf = asset => account => {
  return asset.balanceOf(account);
};

const acBalanceOf = wcaToken => account => {
  return wcaToken.balanceOf(account);
};

const tcBalanceOf = mocCollateralToken => async account => {
  return mocCollateralToken.balanceOf(account);
};

export const mocFunctionsCARBag = async (mocContracts, asset) => {
  return {
    mintTC: mintTC(mocContracts.mocWrapper, asset),
    mintTCto: mintTCto(mocContracts.mocWrapper, asset),
    assetBalanceOf: assetBalanceOf(asset),
    acBalanceOf: acBalanceOf(mocContracts.wcaToken),
    tcBalanceOf: tcBalanceOf(mocContracts.mocCollateralToken),
  };
};
