// @ts-nocheck
import hre, { ethers, getNamedAccounts } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { getNetworkDeployParams } from "../../scripts/utils";
import { mocFunctionsRC20 } from "./mocFunctionsRC20";
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

const executeWrap = (mocQueue, execFee, f) => async args => {
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
  const rc20Functions = await mocFunctionsRC20({
    mocImpl,
    collateralAsset,
    mocCollateralToken,
    mocPeggedTokens,
    priceProviders,
  });
  const { execFeeParams } = getNetworkDeployParams(hre).queueParams;
  return {
    ...rc20Functions,
    mintTC: executeWrap(mocQueue, execFeeParams.tcMintExecFee, rc20Functions.mintTC),
    mintTCto: executeWrap(mocQueue, execFeeParams.tcMintExecFee, rc20Functions.mintTC),
    redeemTC: executeWrap(
      mocQueue,
      execFeeParams.tcRedeemExecFee,
      allowTCWrap(mocImpl, mocCollateralToken, rc20Functions.redeemTC),
    ),
    redeemTCto: executeWrap(
      mocQueue,
      execFeeParams.tcRedeemExecFee,
      allowTCWrap(mocImpl, mocCollateralToken, rc20Functions.redeemTC),
    ),
    mintTP: executeWrap(mocQueue, execFeeParams.tpMintExecFee, rc20Functions.mintTP),
    mintTPto: executeWrap(mocQueue, execFeeParams.tpMintExecFee, rc20Functions.mintTP),
    redeemTP: executeWrap(
      mocQueue,
      execFeeParams.tpRedeemExecFee,
      allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.redeemTP),
    ),
    redeemTPto: executeWrap(
      mocQueue,
      execFeeParams.tpRedeemExecFee,
      allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.redeemTP),
    ),
    mintTCandTP: executeWrap(mocQueue, execFeeParams.mintTCandTPExecFee, rc20Functions.mintTCandTP),
    mintTCandTPto: executeWrap(mocQueue, execFeeParams.mintTCandTPExecFee, rc20Functions.mintTCandTP),
    redeemTCandTP: executeWrap(
      mocQueue,
      execFeeParams.redeemTCandTPExecFee,
      allowTCnTPWrap(mocImpl, mocCollateralToken, mocPeggedTokens, rc20Functions.redeemTCandTP),
    ),
    redeemTCandTPto: executeWrap(
      mocQueue,
      execFeeParams.redeemTCandTPExecFee,
      allowTCnTPWrap(mocImpl, mocCollateralToken, mocPeggedTokens, rc20Functions.redeemTCandTP),
    ),
    swapTPforTP: executeWrap(
      mocQueue,
      execFeeParams.swapTPforTPExecFee,
      allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.swapTPforTP),
    ),
    swapTPforTPto: executeWrap(
      mocQueue,
      execFeeParams.swapTPforTPExecFee,
      allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.swapTPforTP),
    ),
    swapTPforTC: executeWrap(
      mocQueue,
      execFeeParams.swapTPforTCExecFee,
      allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.swapTPforTC),
    ),
    swapTPforTCto: executeWrap(
      mocQueue,
      execFeeParams.swapTPforTCExecFee,
      allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.swapTPforTC),
    ),
    swapTCforTP: executeWrap(
      mocQueue,
      execFeeParams.swapTCforTPExecFee,
      allowTCWrap(mocImpl, mocCollateralToken, rc20Functions.swapTCforTP),
    ),
    swapTCforTPto: executeWrap(
      mocQueue,
      execFeeParams.swapTCforTPExecFee,
      allowTCWrap(mocImpl, mocCollateralToken, rc20Functions.swapTCforTP),
    ),
    getEventArgs: getEventArgs,
    executeQueue: executeQueue(mocQueue),
    getEventSource: () => mocQueue,
    getOperator: () => mocImpl.address,
  };
};
