import { BigNumber } from "ethers";

const PCT_BASE = BigNumber.from((1e18).toString());
const DAY_BLOCK_SPAN = 2880;
const MONTH_BLOCK_SPAN = DAY_BLOCK_SPAN * 30;

const coreParams = {
  protThrld: PCT_BASE.mul(2), // 2
  liqThrld: PCT_BASE.mul(104).div(100), // 1.04
  emaCalculationBlockSpan: DAY_BLOCK_SPAN,
  successFee: PCT_BASE.mul(10).div(100), // 10%
  appreciationFactor: PCT_BASE.mul(50).div(100), // 50%
};

const settlementParams = {
  bes: MONTH_BLOCK_SPAN,
  bmulcdj: 2,
};

const feeParams = {
  feeRetainer: 0, // 0%
  mintFee: PCT_BASE.mul(5).div(100), // 5%
  redeemFee: PCT_BASE.mul(5).div(100), // 5%
  swapTPforTPFee: PCT_BASE.mul(1).div(100), // 1%
  swapTPforTCFee: PCT_BASE.mul(1).div(100), // 1%
  swapTCforTPFee: PCT_BASE.mul(1).div(100), // 1%
  redeemTCandTPFee: PCT_BASE.mul(8).div(100), // 8%
  mintTCandTPFee: PCT_BASE.mul(8).div(100), // 8%
};

const ctParams = {
  name: "CollateralToken",
  symbol: "CT",
};

export const networkConfig = {
  hardhat: {
    coreParams,
    feeParams,
    settlementParams,
    ctParams,
    mocAddresses: {
      governorAddress: "0x26a00af444928d689dDEc7B4D17C0e4A8c9D407A",
      pauserAddress: "0x26a00aF444928D689DDec7B4D17C0e4a8c9d407b",
      mocFeeFlowAddress: "0x26a00aF444928d689DDEC7b4D17c0E4a8c9D407d",
      mocAppreciationBeneficiaryAddress: "0x26A00aF444928D689ddEC7B4D17C0E4A8C9d407F",
    },
  },
};
