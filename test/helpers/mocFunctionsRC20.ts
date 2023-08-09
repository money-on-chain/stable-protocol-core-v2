// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";
import { mocFunctionsCommons, tBalanceOf } from "./mocFunctionsCommons";

const mintTC =
  (mocImpl, collateralAsset) =>
  async ({ from, to, qTC, qACmax = qTC * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (to) {
      if (!vendor) return mocImpl.connect(signer).mintTCto(qTC, qACmax, to);
      return mocImpl.connect(signer).mintTCtoViaVendor(qTC, qACmax, to, vendor);
    } else {
      if (!vendor) return mocImpl.connect(signer).mintTC(qTC, qACmax);
      return mocImpl.connect(signer).mintTCViaVendor(qTC, qACmax, vendor);
    }
  };

const mintTP =
  (mocImpl, collateralAsset, mocPeggedTokens) =>
  async ({ i = 0, tp, from, to, qTP, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }

    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    tp = tp || mocPeggedTokens[i].address;
    if (to) {
      if (!vendor) return mocImpl.connect(signer).mintTPto(tp, qTP, qACmax, to);
      return mocImpl.connect(signer).mintTPtoViaVendor(tp, qTP, qACmax, to, vendor);
    } else {
      if (!vendor) return mocImpl.connect(signer).mintTP(tp, qTP, qACmax);
      return mocImpl.connect(signer).mintTPViaVendor(tp, qTP, qACmax, vendor);
    }
  };

const redeemTP =
  (mocImpl, mocPeggedTokens) =>
  async ({ i = 0, tp, from, to, qTP, qACmin = 0, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    tp = tp || mocPeggedTokens[i].address;
    if (to) {
      if (!vendor) return mocImpl.connect(signer).redeemTPto(tp, qTP, qACmin, to);
      return mocImpl.connect(signer).redeemTPtoViaVendor(tp, qTP, qACmin, to, vendor);
    } else {
      if (!vendor) return mocImpl.connect(signer).redeemTP(tp, qTP, qACmin);
      return mocImpl.connect(signer).redeemTPViaVendor(tp, qTP, qACmin, vendor);
    }
  };

const mintTCandTP =
  (mocImpl, collateralAsset, mocPeggedTokens) =>
  async ({ i = 0, tp, from, to, qTP, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    tp = tp || mocPeggedTokens[i].address;
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (to) {
      if (!vendor) return mocImpl.connect(signer).mintTCandTPto(tp, qTP, qACmax, to);
      return mocImpl.connect(signer).mintTCandTPtoViaVendor(tp, qTP, qACmax, to, vendor);
    } else {
      if (!vendor) return mocImpl.connect(signer).mintTCandTP(tp, qTP, qACmax);
      return mocImpl.connect(signer).mintTCandTPViaVendor(tp, qTP, qACmax, vendor);
    }
  };

const swapTPforTP =
  (mocImpl, collateralAsset, mocPeggedTokens) =>
  async ({
    iFrom,
    iTo,
    tpFrom,
    tpTo,
    from,
    to,
    qTP,
    qTPmin = 0,
    qACmax = qTP * 10,
    vendor = undefined,
    applyPrecision = true,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    tpFrom = tpFrom || mocPeggedTokens[iFrom].address;
    tpTo = tpTo || mocPeggedTokens[iTo].address;
    if (to) {
      if (!vendor) return mocImpl.connect(signer).swapTPforTPto(tpFrom, tpTo, qTP, qTPmin, qACmax, to);
      return mocImpl.connect(signer).swapTPforTPtoViaVendor(tpFrom, tpTo, qTP, qTPmin, qACmax, to, vendor);
    } else {
      if (!vendor) return mocImpl.connect(signer).swapTPforTP(tpFrom, tpTo, qTP, qTPmin, qACmax);
      return mocImpl.connect(signer).swapTPforTPViaVendor(tpFrom, tpTo, qTP, qTPmin, qACmax, vendor);
    }
  };

const swapTPforTC =
  (mocImpl, collateralAsset, mocPeggedTokens) =>
  async ({ i = 0, tp, from, to, qTP, qTCmin = 0, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTCmin = pEth(qTCmin);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    tp = tp || mocPeggedTokens[i].address;
    if (to) {
      if (!vendor) return mocImpl.connect(signer).swapTPforTCto(tp, qTP, qTCmin, qACmax, to);
      return mocImpl.connect(signer).swapTPforTCtoViaVendor(tp, qTP, qTCmin, qACmax, to, vendor);
    } else {
      if (!vendor) return mocImpl.connect(signer).swapTPforTC(tp, qTP, qTCmin, qACmax);
      return mocImpl.connect(signer).swapTPforTCViaVendor(tp, qTP, qTCmin, qACmax, vendor);
    }
  };

const swapTCforTP =
  (mocImpl, collateralAsset, mocPeggedTokens) =>
  async ({ i = 0, tp, from, to, qTC, qTPmin = 0, qACmax = qTC * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    tp = tp || mocPeggedTokens[i].address;
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (to) {
      if (!vendor) return mocImpl.connect(signer).swapTCforTPto(tp, qTC, qTPmin, qACmax, to);
      return mocImpl.connect(signer).swapTCforTPtoViaVendor(tp, qTC, qTPmin, qACmax, to, vendor);
    } else {
      if (!vendor) return mocImpl.connect(signer).swapTCforTP(tp, qTC, qTPmin, qACmax);
      return mocImpl.connect(signer).swapTCforTPViaVendor(tp, qTC, qTPmin, qACmax, vendor);
    }
  };

export const mocFunctionsRC20 = async ({
  mocImpl,
  collateralAsset,
  mocCollateralToken,
  mocPeggedTokens,
  priceProviders,
}) => ({
  mintTC: mintTC(mocImpl, collateralAsset),
  mintTCto: mintTC(mocImpl, collateralAsset),
  mintTP: mintTP(mocImpl, collateralAsset, mocPeggedTokens),
  mintTPto: mintTP(mocImpl, collateralAsset, mocPeggedTokens),
  redeemTP: redeemTP(mocImpl, mocPeggedTokens),
  redeemTPto: redeemTP(mocImpl, mocPeggedTokens),
  mintTCandTP: mintTCandTP(mocImpl, collateralAsset, mocPeggedTokens),
  mintTCandTPto: mintTCandTP(mocImpl, collateralAsset, mocPeggedTokens),
  swapTPforTP: swapTPforTP(mocImpl, collateralAsset, mocPeggedTokens),
  swapTPforTPto: swapTPforTP(mocImpl, collateralAsset, mocPeggedTokens),
  swapTPforTC: swapTPforTC(mocImpl, collateralAsset, mocPeggedTokens),
  swapTPforTCto: swapTPforTC(mocImpl, collateralAsset, mocPeggedTokens),
  swapTCforTP: swapTCforTP(mocImpl, collateralAsset, mocPeggedTokens),
  swapTCforTPto: swapTCforTP(mocImpl, collateralAsset, mocPeggedTokens),
  assetBalanceOf: tBalanceOf(collateralAsset),
  acBalanceOf: tBalanceOf(collateralAsset),
  ...(await mocFunctionsCommons({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders })),
});
