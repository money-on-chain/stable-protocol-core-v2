// @ts-nocheck
import { ethers, getNamedAccounts } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { pEth } from "./utils";

const executeLastOperation = async mocImpl => {
  const operIdCount = await mocImpl.operIdCount();
  const { deployer } = await getNamedAccounts();
  const whitelistedExecutor = await ethers.getSigner(deployer);
  return mocImpl.connect(whitelistedExecutor).execute(operIdCount - 1);
};

const mintTC =
  (mocImpl, collateralAsset) =>
  async ({ from, qTC, qACmax = qTC * 10, vendor = undefined, applyPrecision = true, execute = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (!vendor) await mocImpl.connect(signer).mintTC(qTC, qACmax);
    else await mocImpl.connect(signer).mintTCViaVendor(qTC, qACmax, vendor);
    return execute && executeLastOperation(mocImpl);
  };

const mintTCto =
  (mocImpl, collateralAsset) =>
  async ({ from, to, qTC, qACmax = qTC * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (!vendor) await mocImpl.connect(signer).mintTCto(qTC, qACmax, to);
    else await mocImpl.connect(signer).mintTCtoViaVendor(qTC, qACmax, to, vendor);
    return executeLastOperation(mocImpl);
  };

const redeemTC =
  (mocImpl, mocCollateralToken) =>
  async ({ from, qTC, qACmin = 0, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    await mocCollateralToken.connect(signer).increaseAllowance(mocImpl.address, qTC);
    if (!vendor) await mocImpl.connect(signer).redeemTC(qTC, qACmin);
    else await mocImpl.connect(signer).redeemTCViaVendor(qTC, qACmin, vendor);
    return executeLastOperation(mocImpl);
  };

const redeemTCto =
  (mocImpl, mocCollateralToken) =>
  async ({ from, to, qTC, qACmin = 0, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    await mocCollateralToken.connect(signer).increaseAllowance(mocImpl.address, qTC);
    if (!vendor) await mocImpl.connect(signer).redeemTCto(qTC, qACmin, to);
    else await mocImpl.connect(signer).redeemTCtoViaVendor(qTC, qACmin, to, vendor);
    return executeLastOperation(mocImpl);
  };

const mintTP =
  (mocImpl, collateralAsset) =>
  async ({ i = 0, from, qTP, qACmax = qTP * 10, vendor = undefined, applyPrecision = true, execute = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (!vendor) await mocImpl.connect(signer).mintTP(i, qTP, qACmax);
    else await mocImpl.connect(signer).mintTPViaVendor(i, qTP, qACmax, vendor);
    return execute && executeLastOperation(mocImpl);
  };

const mintTPto =
  (mocImpl, collateralAsset) =>
  async ({ i = 0, from, to, qTP, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (!vendor) await mocImpl.connect(signer).mintTPto(i, qTP, qACmax, to);
    else await mocImpl.connect(signer).mintTPtoViaVendor(i, qTP, qACmax, to, vendor);
    return executeLastOperation(mocImpl);
  };

const redeemTP =
  mocImpl =>
  async ({ i = 0, from, qTP, qACmin = 0, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    if (!vendor) await mocImpl.connect(signer).redeemTP(i, qTP, qACmin);
    else await mocImpl.connect(signer).redeemTPViaVendor(i, qTP, qACmin, vendor);
    return executeLastOperation(mocImpl);
  };

const redeemTPto =
  mocImpl =>
  async ({ i = 0, from, to, qTP, qACmin = 0, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmin = pEth(qACmin);
    }
    if (!vendor) await mocImpl.connect(signer).redeemTPto(i, qTP, qACmin, to);
    else await mocImpl.connect(signer).redeemTPtoViaVendor(i, qTP, qACmin, to, vendor);
    return executeLastOperation(mocImpl);
  };

const mintTCandTP =
  (mocImpl, collateralAsset) =>
  async ({ i = 0, from, qTP, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (!vendor) await mocImpl.connect(signer).mintTCandTP(i, qTP, qACmax);
    else await mocImpl.connect(signer).mintTCandTPViaVendor(i, qTP, qACmax, vendor);
    return executeLastOperation(mocImpl);
  };

const mintTCandTPto =
  (mocImpl, collateralAsset) =>
  async ({ i = 0, from, to, qTP, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (!vendor) await mocImpl.connect(signer).mintTCandTPto(i, qTP, qACmax, to);
    else await mocImpl.connect(signer).mintTCandTPtoViaVendor(i, qTP, qACmax, to, vendor);
    return executeLastOperation(mocImpl);
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
    if (!vendor) await mocImpl.connect(signer).redeemTCandTP(i, qTC, qTP, qACmin);
    else await mocImpl.connect(signer).redeemTCandTPViaVendor(i, qTC, qTP, qACmin, vendor);
    return executeLastOperation(mocImpl);
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
    if (!vendor) await mocImpl.connect(signer).redeemTCandTPto(i, qTC, qTP, qACmin, to);
    else await mocImpl.connect(signer).redeemTCandTPtoViaVendor(i, qTC, qTP, qACmin, to, vendor);
    return executeLastOperation(mocImpl);
  };

const liqRedeemTP =
  mocImpl =>
  async ({ i = 0, from }) => {
    const signer = await ethers.getSigner(from);
    return mocImpl.connect(signer).liqRedeemTP(i);
  };

const liqRedeemTPto =
  mocImpl =>
  async ({ i = 0, from, to }) => {
    const signer = await ethers.getSigner(from);
    return mocImpl.connect(signer).liqRedeemTPto(i, to);
  };

const swapTPforTP =
  (mocImpl, collateralAsset) =>
  async ({ iFrom, iTo, from, qTP, qTPmin = 0, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (!vendor) await mocImpl.connect(signer).swapTPforTP(iFrom, iTo, qTP, qTPmin, qACmax);
    else await mocImpl.connect(signer).swapTPforTPViaVendor(iFrom, iTo, qTP, qTPmin, qACmax, vendor);
    return executeLastOperation(mocImpl);
  };

const swapTPforTPto =
  (mocImpl, collateralAsset) =>
  async ({ iFrom, iTo, from, to, qTP, qTPmin = 0, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (!vendor) await mocImpl.connect(signer).swapTPforTPto(iFrom, iTo, qTP, qTPmin, qACmax, to);
    else await mocImpl.connect(signer).swapTPforTPtoViaVendor(iFrom, iTo, qTP, qTPmin, qACmax, to, vendor);
    return executeLastOperation(mocImpl);
  };

const swapTPforTC =
  (mocImpl, collateralAsset) =>
  async ({ i = 0, from, qTP, qTCmin = 0, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTCmin = pEth(qTCmin);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (!vendor) await mocImpl.connect(signer).swapTPforTC(i, qTP, qTCmin, qACmax);
    else await mocImpl.connect(signer).swapTPforTCViaVendor(i, qTP, qTCmin, qACmax, vendor);
    return executeLastOperation(mocImpl);
  };

const swapTPforTCto =
  (mocImpl, collateralAsset) =>
  async ({ i = 0, from, to, qTP, qTCmin = 0, qACmax = qTP * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTCmin = pEth(qTCmin);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (!vendor) await mocImpl.connect(signer).swapTPforTCto(i, qTP, qTCmin, qACmax, to);
    else await mocImpl.connect(signer).swapTPforTCtoViaVendor(i, qTP, qTCmin, qACmax, to, vendor);
    return executeLastOperation(mocImpl);
  };

const swapTCforTP =
  (mocImpl, collateralAsset) =>
  async ({ i = 0, from, qTC, qTPmin = 0, qACmax = qTC * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (!vendor) await mocImpl.connect(signer).swapTCforTP(i, qTC, qTPmin, qACmax);
    else await mocImpl.connect(signer).swapTCforTPViaVendor(i, qTC, qTPmin, qACmax, vendor);
    return executeLastOperation(mocImpl);
  };

const swapTCforTPto =
  (mocImpl, collateralAsset) =>
  async ({ i = 0, from, to, qTC, qTPmin = 0, qACmax = qTC * 10, vendor = undefined, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    if (!vendor) await mocImpl.connect(signer).swapTCforTPto(i, qTC, qTPmin, qACmax, to);
    else await mocImpl.connect(signer).swapTCforTPtoViaVendor(i, qTC, qTPmin, qACmax, to, vendor);
    return executeLastOperation(mocImpl);
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

// TODO: replace with withNamedArgs when https://github.com/NomicFoundation/hardhat/issues/4166#issuecomment-1640291151 is ready
const getEventArgs = args => [...args, anyValue];

export const mocFunctionsRC20Deferred = async ({
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
  swapTCforTP: swapTCforTP(mocImpl, collateralAsset),
  swapTCforTPto: swapTCforTPto(mocImpl, collateralAsset),
  assetBalanceOf: balanceOf(collateralAsset),
  acBalanceOf: balanceOf(collateralAsset),
  tcBalanceOf: balanceOf(mocCollateralToken),
  tcTransfer: tcTransfer(mocCollateralToken),
  tpBalanceOf: tpBalanceOf(mocPeggedTokens),
  tpTransfer: tpTransfer(mocPeggedTokens),
  pokePrice: pokePrice(priceProviders),
  getEventArgs: getEventArgs,
});
