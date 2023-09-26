// @ts-nocheck
import { ethers, getNamedAccounts } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { MocQueue__factory } from "../../typechain";
import { mocFunctionsRC20 } from "./mocFunctionsRC20";
import { pEth } from "./utils";

const executeLastOperation = mocImpl => async () => {
  const { deployer } = await getNamedAccounts();
  const whitelistedExecutor = await ethers.getSigner(deployer);
  // TODO: maybe cash this
  const mocQueue = MocQueue__factory.connect(await mocImpl.mocQueue(), ethers.provider.getSigner());
  const operIdCount = await mocQueue.operIdCount();
  return mocQueue.connect(whitelistedExecutor).execute(operIdCount - 1);
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

const executeWrap = (mocImpl, f) => async args => {
  if (args.execute === false) {
    return f(args);
  }
  await f(args);
  return executeLastOperation(mocImpl)();
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
    mintTC: executeWrap(mocImpl, rc20Functions.mintTC),
    mintTCto: executeWrap(mocImpl, rc20Functions.mintTC),
    redeemTC: executeWrap(mocImpl, allowTCWrap(mocImpl, mocCollateralToken, rc20Functions.redeemTC)),
    redeemTCto: executeWrap(mocImpl, allowTCWrap(mocImpl, mocCollateralToken, rc20Functions.redeemTC)),
    mintTP: executeWrap(mocImpl, rc20Functions.mintTP),
    mintTPto: executeWrap(mocImpl, rc20Functions.mintTP),
    redeemTP: executeWrap(mocImpl, allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.redeemTP)),
    redeemTPto: executeWrap(mocImpl, allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.redeemTP)),
    mintTCandTP: executeWrap(mocImpl, rc20Functions.mintTCandTP),
    mintTCandTPto: executeWrap(mocImpl, rc20Functions.mintTCandTP),
    redeemTCandTP: executeWrap(
      mocImpl,
      allowTCnTPWrap(mocImpl, mocCollateralToken, mocPeggedTokens, rc20Functions.redeemTCandTP),
    ),
    redeemTCandTPto: executeWrap(
      mocImpl,
      allowTCnTPWrap(mocImpl, mocCollateralToken, mocPeggedTokens, rc20Functions.redeemTCandTP),
    ),
    // TODO: enqueue liq as well?
    //liqRedeemTP: executeWrap(mocImpl, rc20Functions.liqRedeemTP),
    //liqRedeemTPto: executeWrap(mocImpl, rc20Functions.liqRedeemTP),
    swapTPforTP: executeWrap(mocImpl, allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.swapTPforTP)),
    swapTPforTPto: executeWrap(mocImpl, allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.swapTPforTP)),
    swapTPforTC: executeWrap(mocImpl, allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.swapTPforTC)),
    swapTPforTCto: executeWrap(mocImpl, allowTPWrap(mocImpl, mocPeggedTokens, rc20Functions.swapTPforTC)),
    swapTCforTP: executeWrap(mocImpl, allowTCWrap(mocImpl, mocCollateralToken, rc20Functions.swapTCforTP)),
    swapTCforTPto: executeWrap(mocImpl, allowTCWrap(mocImpl, mocCollateralToken, rc20Functions.swapTCforTP)),
    getEventArgs: getEventArgs,
    executeLastOperation: executeLastOperation(mocImpl),
    getEventSource: () => mocQueue,
    getOperator: () => mocImpl.address,
  };
};
