// @ts-nocheck
import hre, { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { getNetworkDeployParams } from "../../scripts/utils";
import { ethersGetBalance, pEth } from "./utils";
import { mocFunctionsCommons } from "./mocFunctionsCommons";
import { assertPrec } from "./assertHelper";

const gasPrice = 0;

const mintTC =
  (mocImpl, tcMintExecFee) =>
  async ({ from, to, qTC, qACmax = qTC * 10, vendor = undefined, applyPrecision = true, execFee = tcMintExecFee }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax).add(execFee);
    } else qACmax += execFee;
    if (to) {
      if (!vendor) return mocImpl.connect(signer).mintTCto(qTC, to, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).mintTCtoViaVendor(qTC, to, vendor, { value: qACmax, gasPrice });
    } else {
      if (!vendor) return mocImpl.connect(signer).mintTC(qTC, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).mintTCViaVendor(qTC, vendor, { value: qACmax, gasPrice });
    }
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
    vendor = undefined,
    applyPrecision = true,
    execFee = tpMintExecFee,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax).add(execFee);
    } else qACmax += execFee;
    tp = tp || mocPeggedTokens[i].address;
    if (to) {
      if (!vendor) return mocImpl.connect(signer).mintTPto(tp, qTP, to, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).mintTPtoViaVendor(tp, qTP, to, vendor, { value: qACmax, gasPrice });
    } else {
      if (!vendor) return mocImpl.connect(signer).mintTP(tp, qTP, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).mintTPViaVendor(tp, qTP, vendor, { value: qACmax, gasPrice });
    }
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
    vendor = undefined,
    applyPrecision = true,
    execFee = mintTCandTPExecFee,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax).add(execFee);
    } else qACmax += execFee;
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
  (mocImpl, mocPeggedTokens, swapTPforTPExecFee) =>
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
    execFee = swapTPforTPExecFee,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax).add(execFee);
    } else qACmax += execFee;
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
  (mocImpl, mocPeggedTokens, swapTPforTCExecFee) =>
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
    execFee = swapTPforTCExecFee,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTCmin = pEth(qTCmin);
      qACmax = pEth(qACmax).add(execFee);
    } else qACmax += execFee;
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
  (mocImpl, mocPeggedTokens, swapTCforTPExecFee) =>
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
    execFee = swapTCforTPExecFee,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax).add(execFee);
    } else qACmax += execFee;
    tp = tp || mocPeggedTokens[i].address;
    if (to) {
      if (!vendor) return mocImpl.connect(signer).swapTCforTPto(tp, qTC, qTPmin, to, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).swapTCforTPtoViaVendor(tp, qTC, qTPmin, to, vendor, { value: qACmax, gasPrice });
    } else {
      if (!vendor) return mocImpl.connect(signer).swapTCforTP(tp, qTC, qTPmin, { value: qACmax, gasPrice });
      return mocImpl.connect(signer).swapTCforTPViaVendor(tp, qTC, qTPmin, vendor, { value: qACmax, gasPrice });
    }
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

export const mocFunctionsCoinbase = async ({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders }) => {
  const commonFncs = await mocFunctionsCommons({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders });
  const { execFeeParams: execFee } = getNetworkDeployParams(hre).queueParams;
  return {
    mintTC: mintTC(mocImpl, execFee.tcMintExecFee),
    mintTP: mintTP(mocImpl, mocPeggedTokens, execFee.tpMintExecFee),
    mintTCandTP: mintTCandTP(mocImpl, mocPeggedTokens, execFee.mintTCandTPExecFee),
    swapTPforTP: swapTPforTP(mocImpl, mocPeggedTokens, execFee.swapTPforTPExecFee),
    swapTPforTC: swapTPforTC(mocImpl, mocPeggedTokens, execFee.swapTPforTCExecFee),
    swapTCforTP: swapTCforTP(mocImpl, mocPeggedTokens, execFee.swapTCforTPExecFee),
    assetBalanceOf: ethersGetBalance,
    acBalanceOf: ethersGetBalance,
    acTransfer: commonFncs.coinbaseTransfer,
    assertACResult: assertACResult(),
    ...commonFncs,
  };
};
