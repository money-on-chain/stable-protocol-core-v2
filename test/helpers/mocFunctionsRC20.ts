// @ts-nocheck
import { ethers } from "hardhat";
import { GAS_LIMIT_PATCH, mineNBlocks, pEth } from "./utils";

const mintTC =
  (mocImpl, collateralAsset) =>
  async ({ from, qTC, qACmax = qTC * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
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
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    return mocImpl.connect(signer).mintTCto(qTC, qACmax, to);
  };

const redeemTC =
  (mocImpl, mocCollateralToken) =>
  async ({ from, qTC, qACmin = 0, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    await mocCollateralToken.connect(signer).increaseAllowance(mocImpl.address, qTC);
    return mocImpl.connect(signer).redeemTC(qTC, qACmin);
  };

const redeemTCto =
  (mocImpl, mocCollateralToken) =>
  async ({ from, to, qTC, qACmin = 0, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    await mocCollateralToken.connect(signer).increaseAllowance(mocImpl.address, qTC);
    return mocImpl.connect(signer).redeemTCto(qTC, qACmin, to);
  };

const mintTP =
  (mocImpl, collateralAsset) =>
  async ({ i = 0, from, qTP, qACmax = qTP * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    return mocImpl.connect(signer).mintTP(i, qTP, qACmax);
  };

const mintTPto =
  (mocImpl, collateralAsset) =>
  async ({ i = 0, from, to, qTP, qACmax = qTP * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    return mocImpl.connect(signer).mintTPto(i, qTP, qACmax, to);
  };

const redeemTP =
  mocImpl =>
  async ({ i = 0, from, qTP, qACmin = 0, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    // mine 1 so that it consumes the same number of blocks as collateralBag and makes the interest payment maths easier
    await mineNBlocks(1);
    return mocImpl.connect(signer).redeemTP(i, qTP, qACmin);
  };

const redeemTPto =
  mocImpl =>
  async ({ i = 0, from, to, qTP, qACmin = 0, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    // mine 1 so that it consumes the same number of blocks as collateralBag and makes the interest payment maths easier
    await mineNBlocks(1);
    return mocImpl.connect(signer).redeemTPto(i, qTP, qACmin, to);
  };

const mintTCandTP =
  (mocImpl, collateralAsset) =>
  async ({ i, from, qTP, qACmax = qTP * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    return mocImpl.connect(signer).mintTCandTP(i, qTP, qACmax);
  };

const mintTCandTPto =
  (mocImpl, collateralAsset) =>
  async ({ i, from, to, qTP, qACmax = qTP * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    return mocImpl.connect(signer).mintTCandTPto(i, qTP, qACmax, to);
  };

const redeemTCandTP =
  mocImpl =>
  async ({ i, from, qTC, qTP, qACmin = 0, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    // mine 2 so that it consumes the same number of blocks as collateralBag and makes the interest payment maths easier
    await mineNBlocks(2);
    return mocImpl.connect(signer).redeemTCandTP(i, qTC, qTP, qACmin);
  };

const redeemTCandTPto =
  mocImpl =>
  async ({ i, from, to, qTC, qTP, qACmin = 0, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    // mine 2 so that it consumes the same number of blocks as collateralBag and makes the interest payment maths easier
    await mineNBlocks(2);
    return mocImpl.connect(signer).redeemTCandTPto(i, qTC, qTP, qACmin, to);
  };

const liqRedeemTP =
  mocImpl =>
  async ({ i = 0, from }) => {
    const signer = await ethers.getSigner(from);
    return mocImpl.connect(signer).liqRedeemTP(i, { gasLimit: GAS_LIMIT_PATCH });
  };

const liqRedeemTPto =
  mocImpl =>
  async ({ i = 0, from, to }) => {
    const signer = await ethers.getSigner(from);
    return mocImpl.connect(signer).liqRedeemTPto(i, to, { gasLimit: GAS_LIMIT_PATCH });
  };

const swapTPforTP =
  (mocImpl, collateralAsset) =>
  async ({ iFrom, iTo, from, qTP, qTPmin = 0, qACmax = qTP * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    // mine 1 so that it consumes the same number of blocks as collateralBag and makes the interest payment maths easier
    await mineNBlocks(1);
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    return mocImpl.connect(signer).swapTPforTP(iFrom, iTo, qTP, qTPmin, qACmax);
  };

const swapTPforTPto =
  (mocImpl, collateralAsset) =>
  async ({ iFrom, iTo, from, to, qTP, qTPmin = 0, qACmax = qTP * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    // mine 1 so that it consumes the same number of blocks as collateralBag and makes the interest payment maths easier
    await mineNBlocks(1);
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    return mocImpl.connect(signer).swapTPforTPto(iFrom, iTo, qTP, qTPmin, qACmax, to);
  };

const swapTPforTC =
  (mocImpl, collateralAsset) =>
  async ({ i, from, qTP, qTCmin = 0, qACmax = qTP * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTCmin = pEth(qTCmin);
      qACmax = pEth(qACmax);
    }
    // mine 1 so that it consumes the same number of blocks as collateralBag and makes the interest payment maths easier
    await mineNBlocks(1);
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    return mocImpl.connect(signer).swapTPforTC(i, qTP, qTCmin, qACmax);
  };

const swapTPforTCto =
  (mocImpl, collateralAsset) =>
  async ({ i, from, to, qTP, qTCmin = 0, qACmax = qTP * 10, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTCmin = pEth(qTCmin);
      qACmax = pEth(qACmax);
    }
    // mine 1 so that it consumes the same number of blocks as collateralBag and makes the interest payment maths easier
    await mineNBlocks(1);
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    return mocImpl.connect(signer).swapTPforTCto(i, qTP, qTCmin, qACmax, to);
  };

const balanceOf = asset => account => asset.balanceOf(account);
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

export const mocFunctionsRC20 = async ({
  mocImpl,
  collateralAsset,
  mocCollateralToken,
  mocPeggedTokens,
  priceProviders,
}) => ({
  mintTC: mintTC(mocImpl, collateralAsset),
  mintTCto: mintTCto(mocImpl, collateralAsset),
  redeemTC: redeemTC(mocImpl, mocCollateralToken),
  redeemTCto: redeemTCto(mocImpl, mocCollateralToken),
  mintTP: mintTP(mocImpl, collateralAsset),
  mintTPto: mintTPto(mocImpl, collateralAsset),
  redeemTP: redeemTP(mocImpl),
  redeemTPto: redeemTPto(mocImpl),
  mintTCandTP: mintTCandTP(mocImpl, collateralAsset),
  mintTCandTPto: mintTCandTPto(mocImpl, collateralAsset),
  redeemTCandTP: redeemTCandTP(mocImpl),
  redeemTCandTPto: redeemTCandTPto(mocImpl),
  liqRedeemTP: liqRedeemTP(mocImpl),
  liqRedeemTPto: liqRedeemTPto(mocImpl),
  swapTPforTP: swapTPforTP(mocImpl, collateralAsset),
  swapTPforTPto: swapTPforTPto(mocImpl, collateralAsset),
  swapTPforTC: swapTPforTC(mocImpl, collateralAsset),
  swapTPforTCto: swapTPforTCto(mocImpl, collateralAsset),
  assetBalanceOf: balanceOf(collateralAsset),
  acBalanceOf: balanceOf(collateralAsset),
  tcBalanceOf: balanceOf(mocCollateralToken),
  tcTransfer: tcTransfer(mocCollateralToken),
  tpBalanceOf: tpBalanceOf(mocPeggedTokens),
  tpTransfer: tpTransfer(mocPeggedTokens),
  pokePrice: pokePrice(priceProviders),
});
