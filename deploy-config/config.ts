import { BigNumber } from "ethers";

const PCT_BASE = BigNumber.from((1e18).toString());
const DAY_BLOCK_SPAN = 2880;
const MONTH_BLOCK_SPAN = DAY_BLOCK_SPAN * 30;

export const coreParams = {
  protThrld: PCT_BASE.mul(2), // 2
  liqThrld: PCT_BASE.mul(104).div(100), // 1.04
  emaCalculationBlockSpan: DAY_BLOCK_SPAN,
};

export const settlementParams = {
  bes: MONTH_BLOCK_SPAN,
  bmulcdj: 2,
};

export const tcParams = {
  mintFee: PCT_BASE.mul(5).div(100), // 5%
  redeemFee: PCT_BASE.mul(5).div(100), // 5%
};

export const tpParams = {
  ctarg: PCT_BASE.mul(4), // 4
  r: 0,
  bmin: DAY_BLOCK_SPAN,
  mintFee: PCT_BASE.mul(5).div(100), // 5%
  redeemFee: PCT_BASE.mul(5).div(100), // 5%
  initialEma: PCT_BASE, // 1
  smoothingFactor: PCT_BASE.mul(47619048).div(10000000000), // 0,047619048
  tils: PCT_BASE.mul(1).div(100), // 1%
  tiMin: PCT_BASE.mul(1).div(1000), // 0.1%
  tiMax: PCT_BASE.mul(10).div(100), // 10%
  abeq: PCT_BASE.mul(25).div(100), // 0.25
  facMin: PCT_BASE.mul(1).div(10), // 0.1
  facMax: PCT_BASE.mul(5).div(1), // 5
};

export const mocAddresses = {
  mainnet: {
    governorAddress: "",
    stopperAddress: "",
    mocFeeFlowAddress: "",
    mocInterestCollectorAddress: "",
  },
  rsktestnet: {
    governorAddress: "",
    stopperAddress: "",
    mocFeeFlowAddress: "",
    mocInterestCollectorAddress: "",
  },
  hardhat: {
    governorAddress: "0x26a00af444928d689dDEc7B4D17C0e4A8c9D407A",
    stopperAddress: "0x26a00aF444928D689DDec7B4D17C0e4a8c9d407b",
    mocFeeFlowAddress: "0x26a00aF444928d689DDEC7b4D17c0E4a8c9D407d",
    mocInterestCollectorAddress: "0x26a00AF444928D689DDeC7b4D17c0E4a8C9d407E",
  },
};
