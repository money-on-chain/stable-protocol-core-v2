// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";

const mintTC =
  (mocWrapper, assetDefault) =>
  async ({ from, qTC, qACmax = qTC * 10, vendor = undefined, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (!vendor) return mocWrapper.connect(signer).mintTC(asset.address, qTC, qACmax);
    return mocWrapper.connect(signer).mintTCViaVendor(asset.address, qTC, qACmax, vendor);
  };

const mintTCto =
  (mocWrapper, assetDefault) =>
  async ({ from, to, qTC, qACmax = qTC * 10, vendor = undefined, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (!vendor) return mocWrapper.connect(signer).mintTCto(asset.address, qTC, qACmax, to);
    return mocWrapper.connect(signer).mintTCtoViaVendor(asset.address, qTC, qACmax, to, vendor);
  };

const redeemTC =
  (mocWrapper, mocCollateralToken, assetDefault) =>
  async ({ from, qTC, qACmin = 0, vendor = undefined, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
    if (!vendor) return mocWrapper.connect(signer).redeemTC(asset.address, qTC, qACmin);
    return mocWrapper.connect(signer).redeemTCViaVendor(asset.address, qTC, qACmin, vendor);
  };

const redeemTCto =
  (mocWrapper, mocCollateralToken, assetDefault) =>
  async ({ from, to, qTC, qACmin = 0, vendor = undefined, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
    if (!vendor) return mocWrapper.connect(signer).redeemTCto(asset.address, qTC, qACmin, to);
    return mocWrapper.connect(signer).redeemTCtoViaVendor(asset.address, qTC, qACmin, to, vendor);
  };

const mintTP =
  (mocWrapper, assetDefault) =>
  async ({ i = 0, from, qTP, qACmax = qTP * 10, vendor = undefined, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (!vendor) return mocWrapper.connect(signer).mintTP(asset.address, i, qTP, qACmax);
    return mocWrapper.connect(signer).mintTPViaVendor(asset.address, i, qTP, qACmax, vendor);
  };

const mintTPto =
  (mocWrapper, assetDefault) =>
  async ({
    i = 0,
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
    if (!vendor) return mocWrapper.connect(signer).mintTPto(asset.address, i, qTP, qACmax, to);
    return mocWrapper.connect(signer).mintTPtoViaVendor(asset.address, i, qTP, qACmax, to, vendor);
  };

const redeemTP =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({ i = 0, from, qTP, qACmin = 0, vendor = undefined, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    if (mocPeggedTokens[i]) {
      await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, qTP);
    }
    if (!vendor) return mocWrapper.connect(signer).redeemTP(asset.address, i, qTP, qACmin);
    return mocWrapper.connect(signer).redeemTPViaVendor(asset.address, i, qTP, qACmin, vendor);
  };

const redeemTPto =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({ i = 0, from, to, qTP, qACmin = 0, vendor = undefined, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    if (mocPeggedTokens[i]) {
      await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, qTP);
    }
    if (!vendor) return mocWrapper.connect(signer).redeemTPto(asset.address, i, qTP, qACmin, to);
    return mocWrapper.connect(signer).redeemTPtoViaVendor(asset.address, i, qTP, qACmin, to, vendor);
  };

const mintTCandTP =
  (mocWrapper, assetDefault) =>
  async ({ i = 0, from, qTP, qACmax = qTP * 10, vendor = undefined, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (!vendor) return mocWrapper.connect(signer).mintTCandTP(asset.address, i, qTP, qACmax);
    return mocWrapper.connect(signer).mintTCandTPViaVendor(asset.address, i, qTP, qACmax, vendor);
  };

const mintTCandTPto =
  (mocWrapper, assetDefault) =>
  async ({
    i = 0,
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
    if (!vendor) return mocWrapper.connect(signer).mintTCandTPto(asset.address, i, qTP, qACmax, to);
    return mocWrapper.connect(signer).mintTCandTPtoViaVendor(asset.address, i, qTP, qACmax, to, vendor);
  };

const redeemTCandTP =
  (mocWrapper, mocCollateralToken, mocPeggedTokens, assetDefault) =>
  async ({ i = 0, from, qTC, qTP, qACmin = 0, vendor = undefined, applyPrecision = true, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    if (mocPeggedTokens[i]) {
      await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, qTP);
    }
    await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
    if (!vendor) return mocWrapper.connect(signer).redeemTCandTP(asset.address, i, qTC, qTP, qACmin);
    return mocWrapper.connect(signer).redeemTCandTPViaVendor(asset.address, i, qTC, qTP, qACmin, vendor);
  };

const redeemTCandTPto =
  (mocWrapper, mocCollateralToken, mocPeggedTokens, assetDefault, asset = assetDefault) =>
  async ({ i = 0, from, to, qTC, qTP, qACmin = 0, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    if (mocPeggedTokens[i]) {
      await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, qTP);
    }
    await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
    if (!vendor) return mocWrapper.connect(signer).redeemTCandTPto(asset.address, i, qTC, qTP, qACmin, to);
    return mocWrapper.connect(signer).redeemTCandTPtoViaVendor(asset.address, i, qTC, qTP, qACmin, to, vendor);
  };

const liqRedeemTP =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({ i = 0, from, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);

    await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, pEth(1e10));
    return mocWrapper.connect(signer).liqRedeemTP(asset.address, i);
  };

const liqRedeemTPto =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({ i = 0, from, to, asset = assetDefault }) => {
    const signer = await ethers.getSigner(from);
    await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, pEth(1e10));
    return mocWrapper.connect(signer).liqRedeemTPto(asset.address, i, to);
  };

const swapTPforTP =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({
    iFrom,
    iTo,
    from,
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
    if (mocPeggedTokens[iFrom]) {
      await mocPeggedTokens[iFrom].connect(signer).increaseAllowance(mocWrapper.address, qTP);
    }
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (!vendor) return mocWrapper.connect(signer).swapTPforTP(asset.address, iFrom, iTo, qTP, qTPmin, qACmax);
    return mocWrapper.connect(signer).swapTPforTPViaVendor(asset.address, iFrom, iTo, qTP, qTPmin, qACmax, vendor);
  };

const swapTPforTPto =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({
    iFrom,
    iTo,
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
    if (mocPeggedTokens[iFrom]) {
      await mocPeggedTokens[iFrom].connect(signer).increaseAllowance(mocWrapper.address, qTP);
    }
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (!vendor) return mocWrapper.connect(signer).swapTPforTPto(asset.address, iFrom, iTo, qTP, qTPmin, qACmax, to);
    return mocWrapper
      .connect(signer)
      .swapTPforTPtoViaVendor(asset.address, iFrom, iTo, qTP, qTPmin, qACmax, to, vendor);
  };

const swapTPforTC =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({
    i = 0,
    from,
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
    if (mocPeggedTokens[i]) {
      await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, qTP);
    }
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (!vendor) return mocWrapper.connect(signer).swapTPforTC(asset.address, i, qTP, qTCmin, qACmax);
    return mocWrapper.connect(signer).swapTPforTCViaVendor(asset.address, i, qTP, qTCmin, qACmax, vendor);
  };

const swapTPforTCto =
  (mocWrapper, mocPeggedTokens, assetDefault) =>
  async ({
    i = 0,
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
    if (mocPeggedTokens[i]) {
      await mocPeggedTokens[i].connect(signer).increaseAllowance(mocWrapper.address, qTP);
    }
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (!vendor) return mocWrapper.connect(signer).swapTPforTCto(asset.address, i, qTP, qTCmin, qACmax, to);
    return mocWrapper.connect(signer).swapTPforTCtoViaVendor(asset.address, i, qTP, qTCmin, qACmax, to, vendor);
  };

const swapTCforTP =
  (mocWrapper, mocCollateralToken, assetDefault) =>
  async ({
    i = 0,
    from,
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
    await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (!vendor) return mocWrapper.connect(signer).swapTCforTP(asset.address, i, qTC, qTPmin, qACmax);
    return mocWrapper.connect(signer).swapTCforTPViaVendor(asset.address, i, qTC, qTPmin, qACmax, vendor);
  };

const swapTCforTPto =
  (mocWrapper, mocCollateralToken, assetDefault) =>
  async ({
    i = 0,
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
    await mocCollateralToken.connect(signer).increaseAllowance(mocWrapper.address, qTC);
    await asset.connect(signer).increaseAllowance(mocWrapper.address, qACmax);
    if (!vendor) return mocWrapper.connect(signer).swapTCforTPto(asset.address, i, qTC, qTPmin, qACmax, to);
    return mocWrapper.connect(signer).swapTCforTPtoViaVendor(asset.address, i, qTC, qTPmin, qACmax, to, vendor);
  };

const balanceOf =
  assetDefault =>
  (account, asset = assetDefault) =>
    asset.balanceOf(account);

const tpBalanceOf = mocPeggedTokens => async (i, account) => mocPeggedTokens[i].balanceOf(account);

// add an asset to the MocCABag whitelist with its respective price provider
const addOrEditAsset = mocWrapper => async (asset, priceProvider) => {
  return mocWrapper.addOrEditAsset(asset.address, priceProvider.address, 18);
};
const pokePrice = priceProviders => async (i, newPrice) => priceProviders[i].poke(pEth(newPrice));

const tcTransfer =
  mocCollateralToken =>
  async ({ from, to, amount, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      amount = pEth(amount);
    }
    return mocCollateralToken.connect(signer).transfer(to, amount, { gasPrice: 0 });
  };

const tpTransfer =
  mocPeggedTokens =>
  async ({ i = 0, from, to, amount, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      amount = pEth(amount);
    }
    return mocPeggedTokens[i].connect(signer).transfer(to, amount, { gasPrice: 0 });
  };

export const mocFunctionsCABag = async ({
  mocWrapper,
  mocCollateralToken,
  assets,
  wcaToken,
  mocPeggedTokens,
  priceProviders,
}) => {
  return {
    mintTC: mintTC(mocWrapper, assets[0]),
    mintTCto: mintTCto(mocWrapper, assets[0]),
    redeemTC: redeemTC(mocWrapper, mocCollateralToken, assets[0]),
    redeemTCto: redeemTCto(mocWrapper, mocCollateralToken, assets[0]),
    mintTP: mintTP(mocWrapper, assets[0]),
    mintTPto: mintTPto(mocWrapper, assets[0]),
    redeemTP: redeemTP(mocWrapper, mocPeggedTokens, assets[0]),
    redeemTPto: redeemTPto(mocWrapper, mocPeggedTokens, assets[0]),
    mintTCandTP: mintTCandTP(mocWrapper, assets[0]),
    mintTCandTPto: mintTCandTPto(mocWrapper, assets[0]),
    redeemTCandTP: redeemTCandTP(mocWrapper, mocCollateralToken, mocPeggedTokens, assets[0]),
    redeemTCandTPto: redeemTCandTPto(mocWrapper, mocCollateralToken, mocPeggedTokens, assets[0]),
    liqRedeemTP: liqRedeemTP(mocWrapper, mocPeggedTokens, assets[0]),
    liqRedeemTPto: liqRedeemTPto(mocWrapper, mocPeggedTokens, assets[0]),
    swapTPforTP: swapTPforTP(mocWrapper, mocPeggedTokens, assets[0]),
    swapTPforTPto: swapTPforTPto(mocWrapper, mocPeggedTokens, assets[0]),
    swapTPforTC: swapTPforTC(mocWrapper, mocPeggedTokens, assets[0]),
    swapTPforTCto: swapTPforTCto(mocWrapper, mocPeggedTokens, assets[0]),
    swapTCforTP: swapTCforTP(mocWrapper, mocCollateralToken, assets[0]),
    swapTCforTPto: swapTCforTPto(mocWrapper, mocCollateralToken, assets[0]),
    assetBalanceOf: balanceOf(assets[0]),
    acBalanceOf: balanceOf(wcaToken),
    tcBalanceOf: balanceOf(mocCollateralToken),
    tcTransfer: tcTransfer(mocCollateralToken),
    tpBalanceOf: tpBalanceOf(mocPeggedTokens),
    tpTransfer: tpTransfer(mocPeggedTokens),
    addOrEditAsset: addOrEditAsset(mocWrapper),
    pokePrice: pokePrice(priceProviders),
  };
};
