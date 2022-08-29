// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";

const mintTC =
  (mocWrapper, assetDefault) =>
  async ({ from, qTC, qACmax = qTC * 10, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).approve(mocWrapper.address, qACmax);
    return mocWrapper.connect(signer).mintTC(asset.address, qTC, qACmax);
  };

const mintTCto =
  (mocWrapper, assetDefault) =>
  async ({ from, to, qTC, qACmax = qTC * 10, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).approve(mocWrapper.address, qACmax);
    return mocWrapper.connect(signer).mintTCto(asset.address, qTC, qACmax, to);
  };

const balanceOf =
  assetDefault =>
  (account, asset = assetDefault) =>
    asset.balanceOf(account);

// add an asset to the MocCABag whitelist with its respective price provider
const addAsset = mocWrapper => async (asset, priceProvider) => {
  return mocWrapper.addAsset(asset.address, priceProvider.address);
};

export const mocFunctionsCARBag = async (mocContracts, assetDefault) => {
  return {
    mintTC: mintTC(mocContracts.mocWrapper, assetDefault),
    mintTCto: mintTCto(mocContracts.mocWrapper, assetDefault),
    assetBalanceOf: balanceOf(assetDefault),
    acBalanceOf: balanceOf(mocContracts.wcaToken),
    tcBalanceOf: balanceOf(mocContracts.mocCollateralToken),
    addAsset: addAsset(mocContracts.mocWrapper),
  };
};
