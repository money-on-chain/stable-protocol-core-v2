// @ts-nocheck
import hre, { ethers, getNamedAccounts } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { mocFunctionsRC20 } from "./mocFunctionsRC20";
import { pEth, getNetworkDeployParams } from "./utils";

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
  const tp = mocPeggedTokens[args.i || 0];
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

export const mocFunctionsRC20Deferred = async ({
  mocImpl,
  collateralAsset,
  mocCollateralToken,
  mocPeggedTokens,
  priceProviders,
  mocQueue,
}) => {
  const rc20Fncs = await mocFunctionsRC20({
    mocImpl,
    collateralAsset,
    mocCollateralToken,
    mocPeggedTokens,
    priceProviders,
  });
  const mocTC = mocCollateralToken;
  const mocTPs = mocPeggedTokens;
  const { execFeeParams: execFee } = getNetworkDeployParams(hre).queueParams;
  return {
    ...rc20Fncs,
    mintTC: execWrap(mocQueue, execFee.tcMintExecFee, rc20Fncs.mintTC),
    redeemTC: execWrap(mocQueue, execFee.tcRedeemExecFee, allowTCWrap(mocImpl, mocTC, rc20Fncs.redeemTC)),
    mintTP: execWrap(mocQueue, execFee.tpMintExecFee, rc20Fncs.mintTP),
    redeemTP: execWrap(mocQueue, execFee.tpRedeemExecFee, allowTPWrap(mocImpl, mocTPs, rc20Fncs.redeemTP)),
    mintTCandTP: execWrap(mocQueue, execFee.mintTCandTPExecFee, rc20Fncs.mintTCandTP),
    redeemTCandTP: execWrap(
      mocQueue,
      execFee.redeemTCandTPExecFee,
      allowTCnTPWrap(mocImpl, mocTC, mocTPs, rc20Fncs.redeemTCandTP),
    ),
    swapTPforTP: execWrap(mocQueue, execFee.swapTPforTPExecFee, allowTPWrap(mocImpl, mocTPs, rc20Fncs.swapTPforTP)),
    swapTPforTC: execWrap(mocQueue, execFee.swapTPforTCExecFee, allowTPWrap(mocImpl, mocTPs, rc20Fncs.swapTPforTC)),
    swapTCforTP: execWrap(mocQueue, execFee.swapTCforTPExecFee, allowTCWrap(mocImpl, mocTC, rc20Fncs.swapTCforTP)),
    getEventArgs: getEventArgs,
    executeQueue: executeQueue(mocQueue),
    getEventSource: () => mocQueue,
    getOperator: () => mocImpl.address,
  };
};
