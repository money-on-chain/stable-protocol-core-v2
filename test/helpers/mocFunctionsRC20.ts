// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";

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

const balanceOf = asset => account => asset.balanceOf(account);
const tpBalanceOf = mocPeggedTokens => async (i, account) => mocPeggedTokens[i].balanceOf(account);

export const mocFunctionsRC20 = async (mocContracts, collateralAsset) => ({
  mintTC: mintTC(mocContracts.mocImpl, collateralAsset),
  mintTCto: mintTCto(mocContracts.mocImpl, collateralAsset),
  mintTP: mintTP(mocContracts.mocImpl, collateralAsset),
  mintTPto: mintTPto(mocContracts.mocImpl, collateralAsset),
  assetBalanceOf: balanceOf(collateralAsset),
  acBalanceOf: balanceOf(collateralAsset),
  tcBalanceOf: balanceOf(mocContracts.mocCollateralToken),
  tpBalanceOf: tpBalanceOf(mocContracts.mocPeggedTokens),
});
