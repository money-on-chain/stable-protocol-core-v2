// @ts-nocheck
import { ethers, getNamedAccounts } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { mocFunctionsRC20 } from "./mocFunctionsRC20";
import { pEth } from "./utils";

const executeQueue =
  mocQueue =>
  async ({ from } = {}) => {
    let signer;
    if (!from) {
      // deployer is a whitelisted executor
      from = (await getNamedAccounts()).deployer;
    }
    signer = await ethers.getSigner(from);
    return mocQueue.connect(signer).execute();
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

const executeWrap = (mocQueue, f) => async args => {
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
  return {
    ...rc20Functions,
    mintTC: executeWrap(mocQueue, rc20Functions.mintTC),
    mintTCto: executeWrap(mocQueue, rc20Functions.mintTC),
    redeemTC: executeWrap(mocQueue, allowTCWrap(mocImpl, mocCollateralToken, rc20Functions.redeemTC)),
    redeemTCto: executeWrap(mocQueue, allowTCWrap(mocImpl, mocCollateralToken, rc20Functions.redeemTC)),
    mintTP: executeWrap(mocQueue, rc20Functions.mintTP),
    mintTPto: executeWrap(mocQueue, rc20Functions.mintTP),
    redeemTP: executeWrap(mocQueue, allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.redeemTP)),
    redeemTPto: executeWrap(mocQueue, allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.redeemTP)),
    mintTCandTP: executeWrap(mocQueue, rc20Functions.mintTCandTP),
    mintTCandTPto: executeWrap(mocQueue, rc20Functions.mintTCandTP),
    redeemTCandTP: executeWrap(
      mocImpl,
      allowTCnTPWrap(mocImpl, mocCollateralToken, mocPeggedTokens, rc20Functions.redeemTCandTP),
    ),
    redeemTCandTPto: executeWrap(
      mocImpl,
      allowTCnTPWrap(mocImpl, mocCollateralToken, mocPeggedTokens, rc20Functions.redeemTCandTP),
    ),
    swapTPforTP: executeWrap(mocQueue, allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.swapTPforTP)),
    swapTPforTPto: executeWrap(mocQueue, allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.swapTPforTP)),
    swapTPforTC: executeWrap(mocQueue, allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.swapTPforTC)),
    swapTPforTCto: executeWrap(mocQueue, allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.swapTPforTC)),
    swapTCforTP: executeWrap(mocQueue, allowTCWrap(mocImpl, mocCollateralToken, rc20Functions.swapTCforTP)),
    swapTCforTPto: executeWrap(mocQueue, allowTCWrap(mocImpl, mocCollateralToken, rc20Functions.swapTCforTP)),
    getEventArgs: getEventArgs,
    executeQueue: executeQueue(mocQueue),
    getEventSource: () => mocQueue,
    getOperator: () => mocImpl.address,
  };
};
