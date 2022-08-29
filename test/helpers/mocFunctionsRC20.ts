// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";

const mintTC =
  (mocCore, collateralAsset) =>
  async ({ from, qTC, qACmax = qTC * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).approve(mocCore.address, qACmax);
    return mocCore.connect(signer).mintTC(qTC, qACmax);
  };

const mintTCto =
  (mocCore, collateralAsset) =>
  async ({ from, to, qTC, qACmax = qTC * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).approve(mocCore.address, qACmax);
    return mocCore.connect(signer).mintTCto(qTC, qACmax, to);
  };

const balanceOf = asset => account => asset.balanceOf(account);

export const mocFunctionsRC20 = async (mocContracts, collateralAsset) => ({
  mintTC: mintTC(mocContracts.mocCore, collateralAsset),
  mintTCto: mintTCto(mocContracts.mocCore, collateralAsset),
  assetBalanceOf: balanceOf(collateralAsset),
  acBalanceOf: balanceOf(collateralAsset),
  tcBalanceOf: balanceOf(mocContracts.mocCollateralToken),
});
