// @ts-nocheck
import { ethers, getNamedAccounts } from "hardhat";
import { pEth } from "./utils";

const redeemTC =
  (mocImpl, mocCollateralToken) =>
  async ({ from, to, qTC, qACmin = 0, vendor = undefined, netParams = { gasPrice: 0 }, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    await mocCollateralToken.connect(signer).increaseAllowance(mocImpl.address, qTC);
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
    tp = tp || mocPeggedTokens[i];
    await tp.connect(signer).increaseAllowance(mocImpl.address, qTP);
    if (to) {
      if (!vendor) return mocImpl.connect(signer).redeemTPto(tp.address, qTP, qACmin, to, netParams);
      return mocImpl.connect(signer).redeemTPtoViaVendor(tp.address, qTP, qACmin, to, vendor, netParams);
    } else {
      if (!vendor) return mocImpl.connect(signer).redeemTP(tp.address, qTP, qACmin, netParams);
      return mocImpl.connect(signer).redeemTPViaVendor(tp.address, qTP, qACmin, vendor, netParams);
    }
  };

const redeemTCandTP =
  (mocImpl, mocCollateralToken, mocPeggedTokens) =>
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
    tp = tp || mocPeggedTokens[i];
    await tp.connect(signer).increaseAllowance(mocImpl.address, qTP);
    await mocCollateralToken.connect(signer).increaseAllowance(mocImpl.address, qTC);
    if (to) {
      if (!vendor) return mocImpl.connect(signer).redeemTCandTPto(tp.address, qTC, qTP, qACmin, to, netParams);
      return mocImpl.connect(signer).redeemTCandTPtoViaVendor(tp.address, qTC, qTP, qACmin, to, vendor, netParams);
    } else {
      if (!vendor) return mocImpl.connect(signer).redeemTCandTP(tp.address, qTC, qTP, qACmin, netParams);
      return mocImpl.connect(signer).redeemTCandTPViaVendor(tp.address, qTC, qTP, qACmin, vendor, netParams);
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

const executeQueue =
  mocQueue =>
  async ({ from, recipient } = {}) => {
    let signer;
    if (!from) {
      // deployer is a whitelisted executor
      from = (await getNamedAccounts()).deployer;
    }
    if (!recipient) {
      recipient = (await getNamedAccounts()).deployer;
    }
    signer = await ethers.getSigner(from);
    return mocQueue.connect(signer).execute(recipient);
  };

const execWrap = mocQueue => (execFee, f) => async args => {
  // if not value provided, send enough coinbase to pay execution fee
  if (args.netParams === undefined) args.netParams = { value: execFee };
  if (args.execute === false) {
    return f(args);
  }
  await f(args);
  return executeQueue(mocQueue)();
};

/// Functions shared across different CA implementations
export const mocFunctionsCommons = async ({
  mocImpl,
  mocQueue,
  mocCollateralToken,
  mocPeggedTokens,
  priceProviders,
  execFee,
}) => {
  const execWrapFnc = execWrap(mocQueue);
  return {
    redeemTC: execWrapFnc(execFee.tcRedeemExecFee, redeemTC(mocImpl, mocCollateralToken)),
    redeemTP: execWrapFnc(execFee.tpRedeemExecFee, redeemTP(mocImpl, mocPeggedTokens)),
    redeemTCandTP: execWrapFnc(
      execFee.redeemTCandTPExecFee,
      redeemTCandTP(mocImpl, mocCollateralToken, mocPeggedTokens),
    ),
    liqRedeemTP: liqRedeemTP(mocImpl, mocPeggedTokens),
    tcBalanceOf: tBalanceOf(mocCollateralToken),
    tpBalanceOf: tpBalanceOf(mocPeggedTokens),
    tcTransfer: tTransfer(mocCollateralToken),
    tpTransfer: tpTransfer(mocPeggedTokens),
    coinbaseTransfer,
    tTransfer,
    pokePrice: pokePrice(priceProviders),
    executeQueue: executeQueue(mocQueue),
    execWrap: execWrapFnc,
  };
};
