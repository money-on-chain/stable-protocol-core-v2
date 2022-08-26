// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";

const mintTC =
  (mocWrapper, assetDefault) =>
  async ({ from, qTC, qACmax = qTC * 10, applyPresicion = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPresicion) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).approve(mocWrapper.address, qACmax);
    return mocWrapper.connect(signer).mintTC(asset.address, qTC, qACmax);
  };

const mintTCto =
  (mocWrapper, assetDefault) =>
  async ({ from, to, qTC, qACmax = qTC * 10, applyPresicion = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPresicion) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).approve(mocWrapper.address, qACmax);
    return mocWrapper.connect(signer).mintTCto(asset.address, qTC, qACmax, to);
  };

const assetBalanceOf =
  assetDefault =>
  (account, asset = assetDefault) => {
    return asset.balanceOf(account);
  };

const acBalanceOf = wcaToken => account => {
  return wcaToken.balanceOf(account);
};

const tcBalanceOf = mocCollateralToken => async account => {
  return mocCollateralToken.balanceOf(account);
};

const addAsset = mocWrapper => async (asset, priceProvider) => {
  return mocWrapper.addAsset(asset.address, priceProvider.address);
};

export const mocFunctionsCARBag = async (mocContracts, assetDefault) => {
  return {
    mintTC: mintTC(mocContracts.mocWrapper, assetDefault),
    mintTCto: mintTCto(mocContracts.mocWrapper, assetDefault),
    assetBalanceOf: assetBalanceOf(assetDefault),
    acBalanceOf: acBalanceOf(mocContracts.wcaToken),
    tcBalanceOf: tcBalanceOf(mocContracts.mocCollateralToken),
    addAsset: addAsset(mocContracts.mocWrapper),
  };
};
