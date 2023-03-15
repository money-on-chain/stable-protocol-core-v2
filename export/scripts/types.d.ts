import { BigNumber } from "ethers";
import { Address } from "hardhat-deploy/dist/types";
export declare type TPParams = {
    name: string;
    symbol: string;
    priceProvider: Address;
    ctarg: BigNumber;
    mintFee: BigNumber;
    redeemFee: BigNumber;
    initialEma: BigNumber;
    smoothingFactor: BigNumber;
};
export declare type AssetParams = {
    assetAddress: Address;
    priceProvider: Address;
    decimals: number;
};
export declare type DeployParameters = {
    coreParams: {
        protThrld: BigNumber;
        liqThrld: BigNumber;
        emaCalculationBlockSpan: number;
        successFee: BigNumber;
        appreciationFactor: BigNumber;
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
    assetParams?: {
        assetParams: AssetParams[];
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
    };
    gasLimit: number;
};
