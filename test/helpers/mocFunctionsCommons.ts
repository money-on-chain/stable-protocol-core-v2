// @ts-nocheck
import { ethers } from "hardhat";
import { pEth } from "./utils";

const redeemTC =
  mocImpl =>
  async ({ from, to, qTC, qACmin = 0, vendor = undefined, netParams = { gasPrice: 0 }, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    if (to) {
      if (!vendor) return mocImpl.connect(signer).redeemTCto(qTC, qACmin, to, netParams);
      return mocImpl.connect(signer).redeemTCtoViaVendor(qTC, qACmin, to, vendor, netParams);
    } else {
      if (!vendor) return mocImpl.connect(signer).redeemTC(qTC, qACmin, netParams);
      return mocImpl.connect(signer).redeemTCViaVendor(qTC, qACmin, vendor, netParams);
    }
  };

const redeemTP =
  (mocImpl, mocPeggedTokens) =>
  async ({
    i = 0,
    tp,
    from,
    to,
    qTP,
    qACmin = 0,
    vendor = undefined,
    netParams = { gasPrice: 0 },
    applyPrecision = true,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    tp = tp || mocPeggedTokens[i].address;
    if (to) {
      if (!vendor) return mocImpl.connect(signer).redeemTPto(tp, qTP, qACmin, to, netParams);
      return mocImpl.connect(signer).redeemTPtoViaVendor(tp, qTP, qACmin, to, vendor, netParams);
    } else {
      if (!vendor) return mocImpl.connect(signer).redeemTP(tp, qTP, qACmin, netParams);
      return mocImpl.connect(signer).redeemTPViaVendor(tp, qTP, qACmin, vendor, netParams);
    }
  };

const redeemTCandTP =
  (mocImpl, mocPeggedTokens) =>
  async ({
    i = 0,
    tp,
    from,
    to,
    qTC,
    qTP,
    qACmin = 0,
    vendor = undefined,
    netParams = { gasPrice: 0 },
    applyPrecision = true,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    tp = tp || mocPeggedTokens[i].address;
    if (to) {
      if (!vendor) return mocImpl.connect(signer).redeemTCandTPto(tp, qTC, qTP, qACmin, to, netParams);
      return mocImpl.connect(signer).redeemTCandTPtoViaVendor(tp, qTC, qTP, qACmin, to, vendor, netParams);
    } else {
      if (!vendor) return mocImpl.connect(signer).redeemTCandTP(tp, qTC, qTP, qACmin, netParams);
      return mocImpl.connect(signer).redeemTCandTPViaVendor(tp, qTC, qTP, qACmin, vendor, netParams);
    }
  };

const liqRedeemTP =
  (mocImpl, mocPeggedTokens) =>
  async ({ i = 0, tp, from, to }) => {
    const signer = await ethers.getSigner(from);
    tp = tp || mocPeggedTokens[i].address;
    if (to) return mocImpl.connect(signer).liqRedeemTPto(tp, to, { gasPrice: 0 });
    else return mocImpl.connect(signer).liqRedeemTP(tp, { gasPrice: 0 });
  };

export const tBalanceOf = token => async account => token.balanceOf(account);
const tpBalanceOf = mocPeggedTokens => async (i, account) => tBalanceOf(mocPeggedTokens[i])(account);
const pokePrice = priceProviders => async (i, newPrice) => priceProviders[i].poke(pEth(newPrice));

const tpTransfer =
  mocPeggedTokens =>
  async ({ i = 0, ...args }) => {
    return tTransfer(mocPeggedTokens[i])(args);
  };

const tTransfer =
  token =>
  async ({ from, to, amount, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      amount = pEth(amount);
    }
    return token.connect(signer).transfer(to, amount, { gasPrice: 0 });
  };

const coinbaseTransfer = async ({ from, to, amount, applyPrecision = true }) => {
  const signer = await ethers.getSigner(from);
  if (applyPrecision) {
    amount = pEth(amount);
  }
  return signer.sendTransaction({
    to,
    value: amount,
  });
};

/// Functions shared across different CA implementations
export const mocFunctionsCommons = async ({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders }) => ({
  redeemTC: redeemTC(mocImpl),
  redeemTP: redeemTP(mocImpl, mocPeggedTokens),
  redeemTCandTP: redeemTCandTP(mocImpl, mocPeggedTokens),
  liqRedeemTP: liqRedeemTP(mocImpl, mocPeggedTokens),
  tcBalanceOf: tBalanceOf(mocCollateralToken),
  tpBalanceOf: tpBalanceOf(mocPeggedTokens),
  tcTransfer: tTransfer(mocCollateralToken),
  tpTransfer: tpTransfer(mocPeggedTokens),
  coinbaseTransfer,
  tTransfer,
  pokePrice: pokePrice(priceProviders),
});
