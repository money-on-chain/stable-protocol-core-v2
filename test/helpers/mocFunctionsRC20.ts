// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";

const mintTC =
  (mocCore, collateralAsset) =>
  async ({ from, qTC, qACmax = qTC * 10, applyPresicion = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPresicion) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).approve(mocCore.address, qACmax);
    return mocCore.connect(signer).mintTC(qTC, qACmax);
  };

const mintTCto =
  (mocCore, collateralAsset) =>
  async ({ from, to, qTC, qACmax = qTC * 10, applyPresicion = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPresicion) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).approve(mocCore.address, qACmax);
    return mocCore.connect(signer).mintTCto(qTC, qACmax, to);
  };

const assetBalanceOf = collateralAsset => account => {
  return collateralAsset.balanceOf(account);
};

const acBalanceOf = collateralAsset => account => {
  return collateralAsset.balanceOf(account);
};

const tcBalanceOf = mocCollateralToken => async account => {
  return mocCollateralToken.balanceOf(account);
};

export const mocFunctionsRC20 = async (mocContracts, collateralAsset) => {
  return {
    mintTC: mintTC(mocContracts.mocCore, collateralAsset),
    mintTCto: mintTCto(mocContracts.mocCore, collateralAsset),
    assetBalanceOf: assetBalanceOf(collateralAsset),
    acBalanceOf: acBalanceOf(collateralAsset),
    tcBalanceOf: tcBalanceOf(mocContracts.mocCollateralToken),
  };
};
