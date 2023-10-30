// @ts-nocheck
import { ethers } from "hardhat";
import { ethersGetBalance, pEth } from "./utils";
import { mocFunctionsCommons } from "./mocFunctionsCommons";

const gasPrice = 0;

const mintTC =
  mocImpl =>
  async ({ from, to, qTC, qACmax = qTC * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    if (to) {
      if (!vendor) return mocImpl.connect(signer).mintTCto(qTC, to, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).mintTCtoViaVendor(qTC, to, vendor, { value: qACmax, gasPrice });
    } else {
      if (!vendor) return mocImpl.connect(signer).mintTC(qTC, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).mintTCViaVendor(qTC, vendor, { value: qACmax, gasPrice });
    }
  };

const mintTP =
  (mocImpl, mocPeggedTokens) =>
  async ({ i = 0, tp, from, to, qTP, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    tp = tp || mocPeggedTokens[i].address;
    if (to) {
      if (!vendor) return mocImpl.connect(signer).mintTPto(tp, qTP, to, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).mintTPtoViaVendor(tp, qTP, to, vendor, { value: qACmax, gasPrice });
    } else {
      if (!vendor) return mocImpl.connect(signer).mintTP(tp, qTP, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).mintTPViaVendor(tp, qTP, vendor, { value: qACmax, gasPrice });
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
      if (!vendor) return mocImpl.connect(signer).redeemTPto(tp, qTP, qACmin, to, { gasPrice });
      return mocImpl.connect(signer).redeemTPtoViaVendor(tp, qTP, qACmin, to, vendor, { gasPrice });
    } else {
      if (!vendor) return mocImpl.connect(signer).redeemTP(tp, qTP, qACmin, { gasPrice });
      return mocImpl.connect(signer).redeemTPViaVendor(tp, qTP, qACmin, vendor, { gasPrice });
    }
  };

const mintTCandTP =
  (mocImpl, mocPeggedTokens) =>
  async ({ i = 0, tp, from, to, qTP, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    tp = tp || mocPeggedTokens[i].address;
    if (to) {
      if (!vendor) return mocImpl.connect(signer).mintTCandTPto(tp, qTP, to, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).mintTCandTPtoViaVendor(tp, qTP, to, vendor, { value: qACmax, gasPrice });
    } else {
      if (!vendor) return mocImpl.connect(signer).mintTCandTP(tp, qTP, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).mintTCandTPViaVendor(tp, qTP, vendor, { value: qACmax, gasPrice });
    }
  };

const swapTPforTP =
  (mocImpl, mocPeggedTokens) =>
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
    tpFrom = tpFrom || mocPeggedTokens[iFrom].address;
    tpTo = tpTo || mocPeggedTokens[iTo].address;
    if (to) {
      if (!vendor)
        return mocImpl.connect(signer).swapTPforTPto(tpFrom, tpTo, qTP, qTPmin, to, { value: qACmax, gasPrice });
      return mocImpl
        .connect(signer)
        .swapTPforTPtoViaVendor(tpFrom, tpTo, qTP, qTPmin, to, vendor, { value: qACmax, gasPrice });
    } else {
      if (!vendor) return mocImpl.connect(signer).swapTPforTP(tpFrom, tpTo, qTP, qTPmin, { value: qACmax, gasPrice });
      return mocImpl
        .connect(signer)
        .swapTPforTPViaVendor(tpFrom, tpTo, qTP, qTPmin, vendor, { value: qACmax, gasPrice });
    }
  };

const swapTPforTC =
  (mocImpl, mocPeggedTokens) =>
  async ({ i = 0, tp, from, to, qTP, qTCmin = 0, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTCmin = pEth(qTCmin);
      qACmax = pEth(qACmax);
    }
    tp = tp || mocPeggedTokens[i].address;
    if (to) {
      if (!vendor) return mocImpl.connect(signer).swapTPforTCto(tp, qTP, qTCmin, to, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).swapTPforTCtoViaVendor(tp, qTP, qTCmin, to, vendor, { value: qACmax, gasPrice });
    } else {
      if (!vendor) return mocImpl.connect(signer).swapTPforTC(tp, qTP, qTCmin, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).swapTPforTCViaVendor(tp, qTP, qTCmin, vendor, { value: qACmax, gasPrice });
    }
  };

const swapTCforTP =
  (mocImpl, mocPeggedTokens) =>
  async ({ i = 0, tp, from, to, qTC, qTPmin = 0, qACmax = qTC * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    tp = tp || mocPeggedTokens[i].address;
    if (to) {
      if (!vendor) return mocImpl.connect(signer).swapTCforTPto(tp, qTC, qTPmin, to, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).swapTCforTPtoViaVendor(tp, qTC, qTPmin, to, vendor, { value: qACmax, gasPrice });
    } else {
      if (!vendor) return mocImpl.connect(signer).swapTCforTP(tp, qTC, qTPmin, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).swapTCforTPViaVendor(tp, qTC, qTPmin, vendor, { value: qACmax, gasPrice });
    }
  };

export const mocFunctionsCoinbase = async ({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders }) => {
  return {
    mintTC: mintTC(mocImpl),
    mintTP: mintTP(mocImpl, mocPeggedTokens),
    redeemTP: redeemTP(mocImpl, mocPeggedTokens),
    mintTCandTP: mintTCandTP(mocImpl, mocPeggedTokens),
    swapTPforTP: swapTPforTP(mocImpl, mocPeggedTokens),
    swapTPforTC: swapTPforTC(mocImpl, mocPeggedTokens),
    swapTCforTP: swapTCforTP(mocImpl, mocPeggedTokens),
    assetBalanceOf: ethersGetBalance,
    acBalanceOf: ethersGetBalance,
    ...(await mocFunctionsCommons({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders })),
  };
};
