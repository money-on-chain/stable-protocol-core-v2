import { BigNumber } from "ethers";

const PCT_BASE = BigNumber.from((1e18).toString());
const DAY_BLOCK_SPAN = 2880;

export const coreParams = {
  ctarg: PCT_BASE.mul(4), // 4
  protThrld: PCT_BASE.mul(2), // 2
  emaCalculationBlockSpan: DAY_BLOCK_SPAN,
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
  initialEma: PCT_BASE, // 1
  smoothingFactor: PCT_BASE.mul(47619048).div(10000000000), // 0,047619048
  tils: PCT_BASE.mul(1).div(100), // 1%
  tiMin: PCT_BASE.mul(1).div(10), // 0.1%
  tiMax: PCT_BASE.mul(10).div(10), // 10%
  abeq: PCT_BASE.mul(25).div(100), // 0.25
  facMin: PCT_BASE.mul(1).div(10), // 0.1
  facMax: PCT_BASE.mul(5).div(1), // 5
};

export const mocAddresses = {
  mainnet: {
    governor: "",
    stopper: "",
    mocFeeFlowAddress: "",
    mocInterestCollectorAddress: "",
  },
  rsktestnet: {
    governor: "",
    stopper: "",
    mocFeeFlowAddress: "",
    mocInterestCollectorAddress: "",
  },
  hardhat: {
    governor: "0x26a00af444928d689dDEc7B4D17C0e4A8c9D407A",
    stopper: "0x26a00aF444928D689DDec7B4D17C0e4a8c9d407b",
    mocFeeFlowAddress: "0x26a00aF444928d689DDEC7b4D17c0E4a8c9D407d",
    mocInterestCollectorAddress: "0x26a00AF444928D689DDeC7b4D17c0E4a8C9d407E",
  },
};
