// @ts-nocheck
import { ethers, getNamedAccounts } from "hardhat";
import { noVendor, pEth } from "./utils";

const redeemTC =
  (mocImpl, mocCollateralToken) =>
  async ({ from, to, qTC, qACmin = 0, vendor = noVendor, netParams = { gasPrice: 0 }, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmin = pEth(qACmin);
    }
    await mocCollateralToken.connect(signer).increaseAllowance(mocImpl.address, qTC);
    return mocImpl.connect(signer).redeemTC(qTC, qACmin, to || from, vendor, netParams);
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
    vendor = noVendor,
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
    return mocImpl.connect(signer).redeemTP(tp.address, qTP, qACmin, to || from, vendor, netParams);
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
    vendor = noVendor,
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
    return mocImpl.connect(signer).redeemTCandTP(tp.address, qTC, qTP, qACmin, to || from, vendor, netParams);
  };

const liqRedeemTP =
  (mocImpl, mocPeggedTokens) =>
  async ({ i = 0, tp, from, to }) => {
    const signer = await ethers.getSigner(from);
    tp = tp || mocPeggedTokens[i].address;
    return mocImpl.connect(signer).liqRedeemTP(tp, to || from, { gasPrice: 0 });
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
