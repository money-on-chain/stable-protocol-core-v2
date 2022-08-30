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

export const mocAddresses = {
  mainnet: {
    governor: "",
    stopper: "",
    mocFeeFlowAddress: "",
  },
  rsktestnet: {
    governor: "",
    stopper: "",
    mocFeeFlowAddress: "",
  },
  hardhat: {
    governor: "0x26a00aF444928d689DDEC7b4D17c0E4a8c9D407d",
    stopper: "0x26a00aF444928d689DDEC7b4D17c0E4a8c9D407d",
    mocFeeFlowAddress: "0x26a00aF444928d689DDEC7b4D17c0E4a8c9D407d",
  },
};
