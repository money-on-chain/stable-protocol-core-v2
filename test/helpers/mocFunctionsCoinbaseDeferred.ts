// @ts-nocheck
import hre, { ethers, getNamedAccounts } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { getNetworkDeployParams } from "../../scripts/utils";
import { mocFunctionsCoinbase } from "./mocFunctionsCoinbase";
import { pEth } from "./utils";

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

const allowTCWrap = (mocImpl, mocCollateralToken, f) => async args => {
  const signer = await ethers.getSigner(args.from);
  await mocCollateralToken.connect(signer).increaseAllowance(mocImpl.address, pEth(args.qTC));
  return f(args);
};

const allowTPWrap = (mocImpl, mocPeggedTokens, f) => async args => {
  const signer = await ethers.getSigner(args.from);
  const tp = mocPeggedTokens[args.i || args.iFrom || 0];
  await tp.connect(signer).increaseAllowance(mocImpl.address, pEth(args.qTP));
  return f(args);
};

const allowTCnTPWrap = (mocImpl, mocCollateralToken, mocPeggedTokens, f) => async args => {
  const signer = await ethers.getSigner(args.from);
  const tp = mocPeggedTokens[args.i || 0];
  await mocCollateralToken.connect(signer).increaseAllowance(mocImpl.address, pEth(args.qTC));
  await tp.connect(signer).increaseAllowance(mocImpl.address, pEth(args.qTP));
  return f(args);
};

const execWrap = (mocQueue, execFee, f) => async args => {
  // if not value provided, send enough coinbase to pay execution fee
  if (args.netParams === undefined) args.netParams = { value: execFee };
  if (args.execute === false) {
    return f(args);
  }
  await f(args);
  return executeQueue(mocQueue)();
};

// TODO: replace with withNamedArgs when https://github.com/NomicFoundation/hardhat/issues/4166#issuecomment-1640291151 is ready
const getEventArgs = args => [...args, anyValue];

export const mocFunctionsCoinbaseDeferred = async ({
  mocImpl,
  mocCollateralToken,
  mocPeggedTokens,
  priceProviders,
  mocQueue,
}) => {
  const coinbaseFncs = await mocFunctionsCoinbase({
    mocImpl,
    mocCollateralToken,
    mocPeggedTokens,
    priceProviders,
  });
  const mocTC = mocCollateralToken;
  const mocTPs = mocPeggedTokens;
  const { execFeeParams: execFee } = getNetworkDeployParams(hre).queueParams;
  return {
    ...coinbaseFncs,
    mintTC: execWrap(mocQueue, execFee.tcMintExecFee, coinbaseFncs.mintTC),
    redeemTC: execWrap(mocQueue, execFee.tcRedeemExecFee, allowTCWrap(mocImpl, mocTC, coinbaseFncs.redeemTC)),
    mintTP: execWrap(mocQueue, execFee.tpMintExecFee, coinbaseFncs.mintTP),
    redeemTP: execWrap(mocQueue, execFee.tpRedeemExecFee, allowTPWrap(mocImpl, mocTPs, coinbaseFncs.redeemTP)),
    mintTCandTP: execWrap(mocQueue, execFee.mintTCandTPExecFee, coinbaseFncs.mintTCandTP),
    redeemTCandTP: execWrap(
      mocQueue,
      execFee.redeemTCandTPExecFee,
      allowTCnTPWrap(mocImpl, mocTC, mocTPs, coinbaseFncs.redeemTCandTP),
    ),
    swapTPforTP: execWrap(mocQueue, execFee.swapTPforTPExecFee, allowTPWrap(mocImpl, mocTPs, coinbaseFncs.swapTPforTP)),
    swapTPforTC: execWrap(mocQueue, execFee.swapTPforTCExecFee, allowTPWrap(mocImpl, mocTPs, coinbaseFncs.swapTPforTC)),
    swapTCforTP: execWrap(mocQueue, execFee.swapTCforTPExecFee, allowTCWrap(mocImpl, mocTC, coinbaseFncs.swapTCforTP)),
    getEventArgs: getEventArgs,
    executeQueue: executeQueue(mocQueue),
    getEventSource: () => mocQueue,
    getOperator: () => mocImpl.address,
  };
};
