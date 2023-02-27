// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";

const mintTC =
  mocImpl =>
  async ({ from, qTC, qACmax = qTC * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    if (!vendor) return mocImpl.connect(signer).mintTC(qTC, { value: qACmax, gasPrice: 0 });
    return mocImpl.connect(signer).mintTCViaVendor(qTC, vendor, { value: qACmax, gasPrice: 0 });
  };

const mintTCto =
  mocImpl =>
  async ({ from, to, qTC, qACmax = qTC * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    if (!vendor) return mocImpl.connect(signer).mintTCto(qTC, to, { value: qACmax, gasPrice: 0 });
    return mocImpl.connect(signer).mintTCtoViaVendor(qTC, to, vendor, { value: qACmax, gasPrice: 0 });
  };

const redeemTC =
  mocImpl =>
  async ({ from, qTC, qACmin = 0, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    if (!vendor) return mocImpl.connect(signer).redeemTC(qTC, qACmin, { gasPrice: 0 });
    return mocImpl.connect(signer).redeemTCViaVendor(qTC, qACmin, vendor, { gasPrice: 0 });
  };

const redeemTCto =
  mocImpl =>
  async ({ from, to, qTC, qACmin = 0, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    if (!vendor) return mocImpl.connect(signer).redeemTCto(qTC, qACmin, to, { gasPrice: 0 });
    return mocImpl.connect(signer).redeemTCtoViaVendor(qTC, qACmin, to, vendor, { gasPrice: 0 });
  };

const mintTP =
  mocImpl =>
  async ({ i = 0, from, qTP, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    if (!vendor) return mocImpl.connect(signer).mintTP(i, qTP, { value: qACmax, gasPrice: 0 });
    return mocImpl.connect(signer).mintTPViaVendor(i, qTP, vendor, { value: qACmax, gasPrice: 0 });
  };

const mintTPto =
  mocImpl =>
  async ({ i = 0, from, to, qTP, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    if (!vendor) return mocImpl.connect(signer).mintTPto(i, qTP, to, { value: qACmax, gasPrice: 0 });
    return mocImpl.connect(signer).mintTPtoViaVendor(i, qTP, to, vendor, { value: qACmax, gasPrice: 0 });
  };

const redeemTP =
  mocImpl =>
  async ({ i = 0, from, qTP, qACmin = 0, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    if (!vendor) return mocImpl.connect(signer).redeemTP(i, qTP, qACmin, { gasPrice: 0 });
    return mocImpl.connect(signer).redeemTPViaVendor(i, qTP, qACmin, vendor, { gasPrice: 0 });
  };

const redeemTPto =
  mocImpl =>
  async ({ i = 0, from, to, qTP, qACmin = 0, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    if (!vendor) return mocImpl.connect(signer).redeemTPto(i, qTP, qACmin, to, { gasPrice: 0 });
    return mocImpl.connect(signer).redeemTPtoViaVendor(i, qTP, qACmin, to, vendor, { gasPrice: 0 });
  };

const mintTCandTP =
  mocImpl =>
  async ({ i = 0, from, qTP, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    if (!vendor) return mocImpl.connect(signer).mintTCandTP(i, qTP, { value: qACmax, gasPrice: 0 });
    return mocImpl.connect(signer).mintTCandTPViaVendor(i, qTP, vendor, { value: qACmax, gasPrice: 0 });
  };

const mintTCandTPto =
  mocImpl =>
  async ({ i = 0, from, to, qTP, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    if (!vendor) return mocImpl.connect(signer).mintTCandTPto(i, qTP, to, { value: qACmax, gasPrice: 0 });
    return mocImpl.connect(signer).mintTCandTPtoViaVendor(i, qTP, to, vendor, { value: qACmax, gasPrice: 0 });
  };

const redeemTCandTP =
  mocImpl =>
  async ({ i = 0, from, qTC, qTP, qACmin = 0, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    if (!vendor) return mocImpl.connect(signer).redeemTCandTP(i, qTC, qTP, qACmin, { gasPrice: 0 });
    return mocImpl.connect(signer).redeemTCandTPViaVendor(i, qTC, qTP, qACmin, vendor, { gasPrice: 0 });
  };

const redeemTCandTPto =
  mocImpl =>
  async ({ i = 0, from, to, qTC, qTP, qACmin = 0, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    if (!vendor) return mocImpl.connect(signer).redeemTCandTPto(i, qTC, qTP, qACmin, to, { gasPrice: 0 });
    return mocImpl.connect(signer).redeemTCandTPtoViaVendor(i, qTC, qTP, qACmin, to, vendor, { gasPrice: 0 });
  };

const liqRedeemTP =
  mocImpl =>
  async ({ i = 0, from }) => {
    const signer = await ethers.getSigner(from);
    return mocImpl.connect(signer).liqRedeemTP(i, { gasPrice: 0 });
  };

const liqRedeemTPto =
  mocImpl =>
  async ({ i = 0, from, to }) => {
    const signer = await ethers.getSigner(from);
    return mocImpl.connect(signer).liqRedeemTPto(i, to, { gasPrice: 0 });
  };

const swapTPforTP =
  mocImpl =>
  async ({ iFrom, iTo, from, qTP, qTPmin = 0, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    if (!vendor) return mocImpl.connect(signer).swapTPforTP(iFrom, iTo, qTP, qTPmin, { value: qACmax, gasPrice: 0 });
    return mocImpl
      .connect(signer)
      .swapTPforTPViaVendor(iFrom, iTo, qTP, qTPmin, vendor, { value: qACmax, gasPrice: 0 });
  };

const swapTPforTPto =
  mocImpl =>
  async ({ iFrom, iTo, from, to, qTP, qTPmin = 0, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    if (!vendor)
      return mocImpl.connect(signer).swapTPforTPto(iFrom, iTo, qTP, qTPmin, to, { value: qACmax, gasPrice: 0 });
    return mocImpl
      .connect(signer)
      .swapTPforTPtoViaVendor(iFrom, iTo, qTP, qTPmin, to, vendor, { value: qACmax, gasPrice: 0 });
  };

const swapTPforTC =
  mocImpl =>
  async ({ i = 0, from, qTP, qTCmin = 0, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTCmin = pEth(qTCmin);
      qACmax = pEth(qACmax);
    }
    if (!vendor) return mocImpl.connect(signer).swapTPforTC(i, qTP, qTCmin, { value: qACmax, gasPrice: 0 });
    return mocImpl.connect(signer).swapTPforTCViaVendor(i, qTP, qTCmin, vendor, { value: qACmax, gasPrice: 0 });
  };

const swapTPforTCto =
  mocImpl =>
  async ({ i = 0, from, to, qTP, qTCmin = 0, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTCmin = pEth(qTCmin);
      qACmax = pEth(qACmax);
    }
    if (!vendor) return mocImpl.connect(signer).swapTPforTCto(i, qTP, qTCmin, to, { value: qACmax, gasPrice: 0 });
    return mocImpl.connect(signer).swapTPforTCtoViaVendor(i, qTP, qTCmin, to, vendor, { value: qACmax, gasPrice: 0 });
  };

const swapTCforTP =
  mocImpl =>
  async ({ i = 0, from, qTC, qTPmin = 0, qACmax = qTC * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    if (!vendor) return mocImpl.connect(signer).swapTCforTP(i, qTC, qTPmin, { value: qACmax, gasPrice: 0 });
    return mocImpl.connect(signer).swapTCforTPViaVendor(i, qTC, qTPmin, vendor, { value: qACmax, gasPrice: 0 });
  };

const swapTCforTPto =
  mocImpl =>
  async ({ i = 0, from, to, qTC, qTPmin = 0, qACmax = qTC * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    if (!vendor) return mocImpl.connect(signer).swapTCforTPto(i, qTC, qTPmin, to, { value: qACmax, gasPrice: 0 });
    return mocImpl.connect(signer).swapTCforTPtoViaVendor(i, qTC, qTPmin, to, vendor, { value: qACmax, gasPrice: 0 });
  };

const ethersGetBalance = () => account => ethers.provider.getBalance(account);

const tcBalanceOf = mocCollateralToken => async account => mocCollateralToken.balanceOf(account);
const tpBalanceOf = mocPeggedTokens => async (i, account) => mocPeggedTokens[i].balanceOf(account);
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

export const mocFunctionsCoinbase = async ({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders }) => {
  return {
    mintTC: mintTC(mocImpl),
    mintTCto: mintTCto(mocImpl),
    redeemTC: redeemTC(mocImpl),
    redeemTCto: redeemTCto(mocImpl),
    mintTP: mintTP(mocImpl),
    mintTPto: mintTPto(mocImpl),
    redeemTP: redeemTP(mocImpl),
    redeemTPto: redeemTPto(mocImpl),
    mintTCandTP: mintTCandTP(mocImpl),
    mintTCandTPto: mintTCandTPto(mocImpl),
    redeemTCandTP: redeemTCandTP(mocImpl),
    redeemTCandTPto: redeemTCandTPto(mocImpl),
    liqRedeemTP: liqRedeemTP(mocImpl),
    liqRedeemTPto: liqRedeemTPto(mocImpl),
    swapTPforTP: swapTPforTP(mocImpl),
    swapTPforTPto: swapTPforTPto(mocImpl),
    swapTPforTC: swapTPforTC(mocImpl),
    swapTPforTCto: swapTPforTCto(mocImpl),
    swapTCforTP: swapTCforTP(mocImpl),
    swapTCforTPto: swapTCforTPto(mocImpl),
    assetBalanceOf: ethersGetBalance(),
    acBalanceOf: ethersGetBalance(),
    tcBalanceOf: tcBalanceOf(mocCollateralToken),
    tcTransfer: tcTransfer(mocCollateralToken),
    tpBalanceOf: tpBalanceOf(mocPeggedTokens),
    tpTransfer: tpTransfer(mocPeggedTokens),
    pokePrice: pokePrice(priceProviders),
  };
};
