"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.networkConfig = void 0;
var ethers_1 = require("ethers");
var PCT_BASE = ethers_1.BigNumber.from((1e18).toString());
var DAY_BLOCK_SPAN = 2880;
var MONTH_BLOCK_SPAN = DAY_BLOCK_SPAN * 30;
var coreParams = {
    protThrld: PCT_BASE.mul(2),
    liqThrld: PCT_BASE.mul(104).div(100),
    emaCalculationBlockSpan: DAY_BLOCK_SPAN,
    successFee: PCT_BASE.mul(10).div(100),
    appreciationFactor: PCT_BASE.mul(50).div(100), // 50%
};
var settlementParams = {
    bes: MONTH_BLOCK_SPAN,
    bmulcdj: 2,
};
var feeParams = {
    feeRetainer: 0,
    mintFee: PCT_BASE.mul(5).div(100),
    redeemFee: PCT_BASE.mul(5).div(100),
    swapTPforTPFee: PCT_BASE.mul(1).div(100),
    swapTPforTCFee: PCT_BASE.mul(1).div(100),
    swapTCforTPFee: PCT_BASE.mul(1).div(100),
    redeemTCandTPFee: PCT_BASE.mul(8).div(100),
    mintTCandTPFee: PCT_BASE.mul(8).div(100), // 8%
};
var ctParams = {
    name: "CollateralToken",
    symbol: "CT",
};
exports.networkConfig = {
    hardhat: {
        coreParams: coreParams,
        feeParams: feeParams,
        settlementParams: settlementParams,
        ctParams: ctParams,
        mocAddresses: {
            governorAddress: "0x26a00af444928d689dDEc7B4D17C0e4A8c9D407A",
            pauserAddress: "0x26a00aF444928D689DDec7B4D17C0e4a8c9d407b",
            mocFeeFlowAddress: "0x26a00aF444928d689DDEC7b4D17c0E4a8c9D407d",
            mocAppreciationBeneficiaryAddress: "0x26A00aF444928D689ddEC7B4D17C0E4A8C9d407F",
        },
    },
};
//# sourceMappingURL=config.js.map