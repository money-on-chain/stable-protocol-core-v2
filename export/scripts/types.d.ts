import { BigNumber } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
export type TPParams = {
    name: string;
    symbol: string;
    priceProvider: Address;
    ctarg: BigNumber;
    mintFee: BigNumber;
    redeemFee: BigNumber;
    initialEma: BigNumber;
    smoothingFactor: BigNumber;
};
export type DeployParameters = {
    coreParams: {
        protThrld: BigNumber;
        liqThrld: BigNumber;
        emaCalculationBlockSpan: number;
        successFee: BigNumber;
        appreciationFactor: BigNumber;
        tcInterestRate: BigNumber;
        tcInterestPaymentBlockSpan: number;
        decayBlockSpan: number;
        transferMaxGas?: number;
    };
    settlementParams: {
        bes: number;
    };
    feeParams: {
        feeRetainer: BigNumber;
        mintFee: BigNumber;
        redeemFee: BigNumber;
        swapTPforTPFee: BigNumber;
        swapTPforTCFee: BigNumber;
        swapTCforTPFee: BigNumber;
        redeemTCandTPFee: BigNumber;
        mintTCandTPFee: BigNumber;
        feeTokenPct: BigNumber;
    };
    ctParams: {
        name: string;
        symbol: string;
    };
    tpParams?: {
        tpParams: TPParams[];
    };
    mocAddresses: {
        collateralAssetAddress?: Address;
        governorAddress: Address;
        pauserAddress: Address;
        feeTokenAddress: Address;
        feeTokenPriceProviderAddress: Address;
        mocFeeFlowAddress: Address;
        mocAppreciationBeneficiaryAddress: Address;
        vendorsGuardianAddress: Address;
        tcInterestCollectorAddress: Address;
        maxAbsoluteOpProviderAddress: Address;
        maxOpDiffProviderAddress: Address;
        coinbaseFailedTransferFallback?: Address;
    };
    queueParams: {
        minOperWaitingBlk: number;
        maxOperPerBatch: number;
        execFeeParams: {
            tpMintExecFee: BigNumber;
            tpRedeemExecFee: BigNumber;
            tcMintExecFee: BigNumber;
            tcRedeemExecFee: BigNumber;
            swapTPforTPExecFee: BigNumber;
            swapTPforTCExecFee: BigNumber;
            swapTCforTPExecFee: BigNumber;
            redeemTCandTPExecFee: BigNumber;
            mintTCandTPExecFee: BigNumber;
        };
    };
    gasLimit: number;
};
