// @ts-nocheck
import hre, { ethers } from "hardhat";
import { getNetworkDeployParams, noVendor } from "../../scripts/utils";
import { pEth } from "./utils";
import { mocFunctionsCommons, tBalanceOf } from "./mocFunctionsCommons";
import { assertPrec } from "./assertHelper";

const mintTC =
  (mocImpl, collateralAsset) =>
  async ({ from, to, qTC, qACmax = qTC * 10, vendor = noVendor, netParams = {}, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    return mocImpl.connect(signer).mintTC(qTC, qACmax, to || from, vendor, netParams);
  };

const mintTP =
  (mocImpl, collateralAsset, mocPeggedTokens) =>
  async ({ i = 0, tp, from, to, qTP, qACmax = qTP * 10, vendor = noVendor, netParams = {}, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    tp = tp || mocPeggedTokens[i].address;
    return mocImpl.connect(signer).mintTP(tp, qTP, qACmax, to || from, vendor, netParams);
  };

const mintTCandTP =
  (mocImpl, collateralAsset, mocPeggedTokens) =>
  async ({ i = 0, tp, from, to, qTP, qACmax = qTP * 10, vendor = noVendor, netParams = {}, applyPrecision = true }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qACmax = pEth(qACmax);
    }
    tp = tp || mocPeggedTokens[i].address;
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    return mocImpl.connect(signer).mintTCandTP(tp, qTP, qACmax, to || from, vendor, netParams);
  };

const swapTPforTP =
  (mocImpl, collateralAsset, mocPeggedTokens) =>
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
    netParams = {},
    applyPrecision = true,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    tpFrom = tpFrom || mocPeggedTokens[iFrom];
    tpTo = tpTo || mocPeggedTokens[iTo];
    await tpFrom.connect(signer).increaseAllowance(mocImpl.address, qTP);
    return mocImpl
      .connect(signer)
      .swapTPforTP(tpFrom.address, tpTo.address, qTP, qTPmin, qACmax, to || from, vendor, netParams);
  };

const swapTPforTC =
  (mocImpl, collateralAsset, mocPeggedTokens) =>
  async ({
    i = 0,
    tp,
    from,
    to,
    qTP,
    qTCmin = 0,
    qACmax = qTP * 10,
    vendor = noVendor,
    netParams = {},
    applyPrecision = true,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTP = pEth(qTP);
      qTCmin = pEth(qTCmin);
      qACmax = pEth(qACmax);
    }
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    tp = tp || mocPeggedTokens[i];
    await tp.connect(signer).increaseAllowance(mocImpl.address, qTP);
    return mocImpl.connect(signer).swapTPforTC(tp.address, qTP, qTCmin, qACmax, to || from, vendor, netParams);
  };

const swapTCforTP =
  (mocImpl, collateralAsset, mocCollateralToken, mocPeggedTokens) =>
  async ({
    i = 0,
    tp,
    from,
    to,
    qTC,
    qTPmin = 0,
    qACmax = qTC * 10,
    vendor = noVendor,
    netParams = {},
    applyPrecision = true,
  }) => {
    const signer = await ethers.getSigner(from);
    if (applyPrecision) {
      qTC = pEth(qTC);
      qTPmin = pEth(qTPmin);
      qACmax = pEth(qACmax);
    }
    tp = tp || mocPeggedTokens[i].address;
    await mocCollateralToken.connect(signer).increaseAllowance(mocImpl.address, qTC);
    await collateralAsset.connect(signer).increaseAllowance(mocImpl.address, qACmax);
    return mocImpl.connect(signer).swapTCforTP(tp, qTC, qTPmin, qACmax, to || from, vendor, netParams);
  };

export const mocFunctionsRC20 = async ({
  mocImpl,
  mocQueue,
  collateralAsset,
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
    mintTC: execWrap(execFee.tcMintExecFee, mintTC(mocImpl, collateralAsset)),
    mintTP: execWrap(execFee.tpMintExecFee, mintTP(mocImpl, collateralAsset, mocPeggedTokens)),
    mintTCandTP: execWrap(execFee.mintTCandTPExecFee, mintTCandTP(mocImpl, collateralAsset, mocPeggedTokens)),
    swapTPforTP: execWrap(execFee.swapTPforTPExecFee, swapTPforTP(mocImpl, collateralAsset, mocPeggedTokens)),
    swapTPforTC: execWrap(execFee.swapTPforTCExecFee, swapTPforTC(mocImpl, collateralAsset, mocPeggedTokens)),
    swapTCforTP: execWrap(
      execFee.swapTCforTPExecFee,
      swapTCforTP(mocImpl, collateralAsset, mocCollateralToken, mocPeggedTokens),
    ),
    assetBalanceOf: tBalanceOf(collateralAsset),
    acBalanceOf: tBalanceOf(collateralAsset),
    assertACResult: () => assertPrec,
    acTransfer: commonFncs.tTransfer(collateralAsset),
    refreshACBalance: () => mocImpl.refreshACBalance(),
    ...commonFncs,
  };
};
