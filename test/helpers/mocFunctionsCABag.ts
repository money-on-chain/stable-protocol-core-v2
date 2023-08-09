// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";
import { mocFunctionsCommons, tBalanceOf } from "./mocFunctionsCommons";

const mintTC =
  (mocWrapper, assetDefault) =>
  async ({ from, to, qTC, qACmax = qTC * 10, vendor = undefined, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (to) {
      if (!vendor) return mocWrapper.connect(signer).mintTCto(asset.address, qTC, qACmax, to);
      return mocWrapper.connect(signer).mintTCtoViaVendor(asset.address, qTC, qACmax, to, vendor);
    } else {
      if (!vendor) return mocWrapper.connect(signer).mintTC(asset.address, qTC, qACmax);
      return mocWrapper.connect(signer).mintTCViaVendor(asset.address, qTC, qACmax, vendor);
    }
  };

const redeemTC =
  (mocWrapper, mocCollateralToken, assetDefault) =>
  async ({ from, to, qTC, qACmin = 0, vendor = undefined, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
    if (to) {
      if (!vendor) return mocWrapper.connect(signer).redeemTCto(asset.address, qTC, qACmin, to);
      return mocWrapper.connect(signer).redeemTCtoViaVendor(asset.address, qTC, qACmin, to, vendor);
    } else {
      if (!vendor) return mocWrapper.connect(signer).redeemTC(asset.address, qTC, qACmin);
      return mocWrapper.connect(signer).redeemTCViaVendor(asset.address, qTC, qACmin, vendor);
    }
  };

const mintTP =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({
    i = 0,
    tp,
    from,
    to,
    qTP,
    qACmax = qTP * 10,
    vendor = undefined,
    applyPrecision = true,
    asset = assetDefault,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    tp = tp || mocPeggedTokens[i].address;
    if (to) {
      if (!vendor) return mocWrapper.connect(signer).mintTPto(asset.address, tp, qTP, qACmax, to);
      return mocWrapper.connect(signer).mintTPtoViaVendor(asset.address, tp, qTP, qACmax, to, vendor);
    } else {
      if (!vendor) return mocWrapper.connect(signer).mintTP(asset.address, tp, qTP, qACmax);
      return mocWrapper.connect(signer).mintTPViaVendor(asset.address, tp, qTP, qACmax, vendor);
    }
  };

const redeemTP =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({ i = 0, tp, from, to, qTP, qACmin = 0, vendor = undefined, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    if (!tp && mocPeggedTokens[i]) {
      tp = mocPeggedTokens[i].address;
      await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, qTP);
    }
    if (to) {
      if (!vendor) return mocWrapper.connect(signer).redeemTPto(asset.address, tp, qTP, qACmin, to);
      return mocWrapper.connect(signer).redeemTPtoViaVendor(asset.address, tp, qTP, qACmin, to, vendor);
    } else {
      if (!vendor) return mocWrapper.connect(signer).redeemTP(asset.address, tp, qTP, qACmin);
      return mocWrapper.connect(signer).redeemTPViaVendor(asset.address, tp, qTP, qACmin, vendor);
    }
  };

const mintTCandTP =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({
    i = 0,
    tp,
    from,
    to,
    qTP,
    qACmax = qTP * 10,
    vendor = undefined,
    applyPrecision = true,
    asset = assetDefault,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    tp = tp || mocPeggedTokens[i].address;
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (to) {
      if (!vendor) return mocWrapper.connect(signer).mintTCandTPto(asset.address, tp, qTP, qACmax, to);
      return mocWrapper.connect(signer).mintTCandTPtoViaVendor(asset.address, tp, qTP, qACmax, to, vendor);
    } else {
      if (!vendor) return mocWrapper.connect(signer).mintTCandTP(asset.address, tp, qTP, qACmax);
      return mocWrapper.connect(signer).mintTCandTPViaVendor(asset.address, tp, qTP, qACmax, vendor);
    }
  };

const redeemTCandTP =
  (mocWrapper, mocCollateralToken, mocPeggedTokens, assetDefault, asset = assetDefault) =>
  async ({ i = 0, tp, from, to, qTC, qTP, qACmin = 0, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    if (!tp && mocPeggedTokens[i]) {
      tp = mocPeggedTokens[i].address;
      await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, qTP);
    }
    await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
    if (to) {
      if (!vendor) return mocWrapper.connect(signer).redeemTCandTPto(asset.address, tp, qTC, qTP, qACmin, to);
      return mocWrapper.connect(signer).redeemTCandTPtoViaVendor(asset.address, tp, qTC, qTP, qACmin, to, vendor);
    } else {
      if (!vendor) return mocWrapper.connect(signer).redeemTCandTP(asset.address, tp, qTC, qTP, qACmin);
      return mocWrapper.connect(signer).redeemTCandTPViaVendor(asset.address, tp, qTC, qTP, qACmin, vendor);
    }
  };

const liqRedeemTP =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({ i = 0, tp, from, to, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    tp = tp || mocPeggedTokens[i].address;
    await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, pEth(1e10));
    if (to) return mocWrapper.connect(signer).liqRedeemTPto(asset.address, tp, to);
    else return mocWrapper.connect(signer).liqRedeemTP(asset.address, tp);
  };

const swapTPforTP =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
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
    asset = assetDefault,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    tpFrom = tpFrom || mocPeggedTokens[iFrom].address;
    tpTo = tpTo || mocPeggedTokens[iTo].address;
    if (mocPeggedTokens[iFrom]) {
      await mocPeggedTokens[iFrom].connect(signer).increaseAllowance(mocWrapper.address, qTP);
    }
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (to) {
      if (!vendor)
        return mocWrapper.connect(signer).swapTPforTPto(asset.address, tpFrom, tpTo, qTP, qTPmin, qACmax, to);
      return mocWrapper
        .connect(signer)
        .swapTPforTPtoViaVendor(asset.address, tpFrom, tpTo, qTP, qTPmin, qACmax, to, vendor);
    } else {
      if (!vendor) return mocWrapper.connect(signer).swapTPforTP(asset.address, tpFrom, tpTo, qTP, qTPmin, qACmax);
      return mocWrapper.connect(signer).swapTPforTPViaVendor(asset.address, tpFrom, tpTo, qTP, qTPmin, qACmax, vendor);
    }
  };

const swapTPforTC =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({
    i = 0,
    tp,
    from,
    to,
    qTP,
    qTCmin = 0,
    qACmax = qTP * 10,
    vendor = undefined,
    applyPrecision = true,
    asset = assetDefault,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTCmin = pEth(qTCmin);
      qACmax = pEth(qACmax);
    }
    tp = tp || mocPeggedTokens[i].address;
    if (mocPeggedTokens[i]) {
      await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, qTP);
    }
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (to) {
      if (!vendor) return mocWrapper.connect(signer).swapTPforTCto(asset.address, tp, qTP, qTCmin, qACmax, to);
      return mocWrapper.connect(signer).swapTPforTCtoViaVendor(asset.address, tp, qTP, qTCmin, qACmax, to, vendor);
    } else {
      if (!vendor) return mocWrapper.connect(signer).swapTPforTC(asset.address, tp, qTP, qTCmin, qACmax);
      return mocWrapper.connect(signer).swapTPforTCViaVendor(asset.address, tp, qTP, qTCmin, qACmax, vendor);
    }
  };

const swapTCforTP =
  (mocWrapper, mocPeggedTokens, mocCollateralToken, assetDefault) =>
  async ({
    i = 0,
    tp,
    from,
    to,
    qTC,
    qTPmin = 0,
    qACmax = qTC * 10,
    vendor = undefined,
    applyPrecision = true,
    asset = assetDefault,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    tp = tp || mocPeggedTokens[i].address;
    await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (to) {
      if (!vendor) return mocWrapper.connect(signer).swapTCforTPto(asset.address, tp, qTC, qTPmin, qACmax, to);
      return mocWrapper.connect(signer).swapTCforTPtoViaVendor(asset.address, tp, qTC, qTPmin, qACmax, to, vendor);
    } else {
      if (!vendor) return mocWrapper.connect(signer).swapTCforTP(asset.address, tp, qTC, qTPmin, qACmax);
      return mocWrapper.connect(signer).swapTCforTPViaVendor(asset.address, tp, qTC, qTPmin, qACmax, vendor);
    }
  };

const balanceOf =
  assetDefault =>
  (account, asset = assetDefault) =>
    asset.balanceOf(account);

// add an asset to the MocCABag whitelist with its respective price provider
const addOrEditAsset = mocWrapper => async (asset, priceProvider) => {
  return mocWrapper.addOrEditAsset(asset.address, priceProvider.address, 18);
};

export const mocFunctionsCABag = async ({
  mocWrapper,
  mocCollateralToken,
  assets,
  wcaToken,
  mocPeggedTokens,
  priceProviders,
}) => {
  const commons = await mocFunctionsCommons({ mocCollateralToken, mocPeggedTokens, priceProviders });
  const defaultAsset = assets[0];
  return {
    mintTC: mintTC(mocWrapper, defaultAsset),
    mintTCto: mintTC(mocWrapper, defaultAsset),
    redeemTC: redeemTC(mocWrapper, mocCollateralToken, defaultAsset),
    redeemTCto: redeemTC(mocWrapper, mocCollateralToken, defaultAsset),
    mintTP: mintTP(mocWrapper, mocPeggedTokens, defaultAsset),
    mintTPto: mintTP(mocWrapper, mocPeggedTokens, defaultAsset),
    redeemTP: redeemTP(mocWrapper, mocPeggedTokens, defaultAsset),
    redeemTPto: redeemTP(mocWrapper, mocPeggedTokens, defaultAsset),
    mintTCandTP: mintTCandTP(mocWrapper, mocPeggedTokens, defaultAsset),
    mintTCandTPto: mintTCandTP(mocWrapper, mocPeggedTokens, defaultAsset),
    redeemTCandTP: redeemTCandTP(mocWrapper, mocCollateralToken, mocPeggedTokens, defaultAsset),
    redeemTCandTPto: redeemTCandTP(mocWrapper, mocCollateralToken, mocPeggedTokens, defaultAsset),
    liqRedeemTP: liqRedeemTP(mocWrapper, mocPeggedTokens, defaultAsset),
    liqRedeemTPto: liqRedeemTP(mocWrapper, mocPeggedTokens, defaultAsset),
    swapTPforTP: swapTPforTP(mocWrapper, mocPeggedTokens, defaultAsset),
    swapTPforTPto: swapTPforTP(mocWrapper, mocPeggedTokens, defaultAsset),
    swapTPforTC: swapTPforTC(mocWrapper, mocPeggedTokens, defaultAsset),
    swapTPforTCto: swapTPforTC(mocWrapper, mocPeggedTokens, defaultAsset),
    swapTCforTP: swapTCforTP(mocWrapper, mocPeggedTokens, mocCollateralToken, defaultAsset),
    swapTCforTPto: swapTCforTP(mocWrapper, mocPeggedTokens, mocCollateralToken, defaultAsset),
    assetBalanceOf: balanceOf(defaultAsset),
    acBalanceOf: tBalanceOf(wcaToken),
    addOrEditAsset: addOrEditAsset(mocWrapper),
    tcBalanceOf: commons.tcBalanceOf,
    tpBalanceOf: commons.tpBalanceOf,
    tcTransfer: commons.tcTransfer,
    tpTransfer: commons.tpTransfer,
    pokePrice: commons.pokePrice,
  };
};
