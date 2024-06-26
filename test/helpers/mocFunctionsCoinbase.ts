// @ts-nocheck
import hre, { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { getNetworkDeployParams, noVendor } from "../../scripts/utils";
import { ethersGetBalance, pEth } from "./utils";
import { mocFunctionsCommons } from "./mocFunctionsCommons";
import { assertPrec } from "./assertHelper";

const gasPrice = 0;

const mintTC =
  (mocImpl, tcMintExecFee) =>
  async ({ from, to, qTC, qACmax = qTC * 10, vendor = noVendor, applyPrecision = true, execFee = tcMintExecFee }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax).add(execFee);
    } else qACmax += execFee;
    return mocImpl.connect(signer).mintTC(qTC, to || from, vendor, { value: qACmax, gasPrice });
  };

const mintTP =
  (mocImpl, mocPeggedTokens, tpMintExecFee) =>
  async ({
    i = 0,
    tp,
    from,
    to,
    qTP,
    qACmax = qTP * 10,
    vendor = noVendor,
    applyPrecision = true,
    execFee = tpMintExecFee,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax).add(execFee);
    } else qACmax += execFee;
    tp = tp || mocPeggedTokens[i].address;
    return mocImpl.connect(signer).mintTP(tp, qTP, to || from, vendor, { value: qACmax, gasPrice });
  };

const mintTCandTP =
  (mocImpl, mocPeggedTokens, mintTCandTPExecFee) =>
  async ({
    i = 0,
    tp,
    from,
    to,
    qTP,
    qACmax = qTP * 10,
    vendor = noVendor,
    applyPrecision = true,
    execFee = mintTCandTPExecFee,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax).add(execFee);
    } else qACmax += execFee;
    tp = tp || mocPeggedTokens[i].address;
    return mocImpl.connect(signer).mintTCandTP(tp, qTP, to || from, vendor, { value: qACmax, gasPrice });
  };

const swapTPforTP =
  (mocImpl, mocPeggedTokens, swapTPforTPExecFee) =>
  async ({
    iFrom = 0,
    iTo = 1,
    tpFrom,
    tpTo,
    from,
    to,
    qTP,
    qTPmin = 0,
    qACmax = qTP * 10,
    vendor = noVendor,
    applyPrecision = true,
    execFee = swapTPforTPExecFee,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax).add(execFee);
    } else qACmax += execFee;
    tpFrom = tpFrom || mocPeggedTokens[iFrom];
    tpTo = tpTo || mocPeggedTokens[iTo];
    await tpFrom.connect(signer).increaseAllowance(mocImpl.address, qTP);
    return mocImpl
      .connect(signer)
      .swapTPforTP(tpFrom.address, tpTo.address, qTP, qTPmin, to || from, vendor, { value: qACmax, gasPrice });
  };

const swapTPforTC =
  (mocImpl, mocPeggedTokens, swapTPforTCExecFee) =>
  async ({
    i = 0,
    tp,
    from,
    to,
    qTP,
    qTCmin = 0,
    qACmax = qTP * 10,
    vendor = noVendor,
    applyPrecision = true,
    execFee = swapTPforTCExecFee,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTCmin = pEth(qTCmin);
      qACmax = pEth(qACmax).add(execFee);
    } else qACmax += execFee;
    tp = tp || mocPeggedTokens[i];
    await tp.connect(signer).increaseAllowance(mocImpl.address, qTP);
    return mocImpl
      .connect(signer)
      .swapTPforTC(tp.address, qTP, qTCmin, to || from, vendor, { value: qACmax, gasPrice });
  };

const swapTCforTP =
  (mocImpl, mocCollateralToken, mocPeggedTokens, swapTCforTPExecFee) =>
  async ({
    i = 0,
    tp,
    from,
    to,
    qTC,
    qTPmin = 0,
    qACmax = qTC * 10,
    vendor = noVendor,
    applyPrecision = true,
    execFee = swapTCforTPExecFee,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax).add(execFee);
    } else qACmax += execFee;
    tp = tp || mocPeggedTokens[i].address;
    await mocCollateralToken.connect(signer).increaseAllowance(mocImpl.address, qTC);
    return mocImpl.connect(signer).swapTCforTP(tp, qTC, qTPmin, to || from, vendor, { value: qACmax, gasPrice });
  };

const assertACResult =
  () =>
  execFee =>
  (...args) => {
    if (!BigNumber.isBigNumber(args[0])) {
      args[0] = pEth(args[0]);
    }
    return assertPrec(args[0].add(execFee), ...args.slice(1));
  };

export const mocFunctionsCoinbase = async ({
  mocImpl,
  mocQueue,
  mocCollateralToken,
  mocPeggedTokens,
  priceProviders,
}) => {
  const { execFeeParams: execFee } = getNetworkDeployParams(hre).queueParams;
  const commonFncs = await mocFunctionsCommons({
    mocImpl,
    mocQueue,
    mocCollateralToken,
    mocPeggedTokens,
    priceProviders,
    execFee,
  });
  const execWrap = commonFncs.execWrap;
  return {
    mintTC: execWrap(execFee.tcMintExecFee, mintTC(mocImpl, execFee.tcMintExecFee)),
    mintTP: execWrap(execFee.tpMintExecFee, mintTP(mocImpl, mocPeggedTokens, execFee.tpMintExecFee)),
    mintTCandTP: execWrap(
      execFee.mintTCandTPExecFee,
      mintTCandTP(mocImpl, mocPeggedTokens, execFee.mintTCandTPExecFee),
    ),
    swapTPforTP: execWrap(
      execFee.swapTPforTPExecFee,
      swapTPforTP(mocImpl, mocPeggedTokens, execFee.swapTPforTPExecFee),
    ),
    swapTPforTC: execWrap(
      execFee.swapTPforTCExecFee,
      swapTPforTC(mocImpl, mocPeggedTokens, execFee.swapTPforTCExecFee),
    ),
    swapTCforTP: execWrap(
      execFee.swapTCforTPExecFee,
      swapTCforTP(mocImpl, mocCollateralToken, mocPeggedTokens, execFee.swapTCforTPExecFee),
    ),
    assetBalanceOf: ethersGetBalance,
    acBalanceOf: ethersGetBalance,
    acTransfer: commonFncs.coinbaseTransfer,
    assertACResult: assertACResult(),
    refreshACBalance: () => {},
    ...commonFncs,
  };
};
