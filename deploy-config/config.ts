import { BigNumber } from "ethers";

const PCT_BASE = BigNumber.from((1e18).toString());

export const coreParams = {
  ctarg: PCT_BASE.mul(4), // 4
  protThrld: PCT_BASE.mul(2), // 2
};

export const tcParams = {
  mintFee: PCT_BASE.mul(5).div(100), // 5%
  redeemFee: PCT_BASE.mul(5).div(100), // 5%
};

export const tpParams = {
  r: 0,
  bmin: 0,
  mintFee: PCT_BASE.mul(5).div(100), // 5%
  redeemFee: PCT_BASE.mul(5).div(100), // 5%
};
