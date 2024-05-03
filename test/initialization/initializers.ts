import hre from "hardhat";
import { Address } from "hardhat-deploy/types";
import { BigNumberish } from "ethers";
import { getNetworkDeployParams } from "../helpers/utils";

const { coreParams, feeParams, settlementParams, mocAddresses } = getNetworkDeployParams(hre);

export function mocInitialize(
  mocCARC20: any,
  mocTC: Address,
  mocCoreExpansion: Address,
  mocVendors: Address,
  mocQueue: Address,
  extraArgs: {},
) {
  return ({
    mocGovernorAddress = mocAddresses.governorAddress,
    mocPauserAddress = mocAddresses.pauserAddress,
    feeTokenAddress = mocAddresses.feeTokenAddress,
    feeTokenPriceProviderAddress = mocAddresses.feeTokenPriceProviderAddress,
    mocTCAddress = mocTC,
    mocCoreExpansionAddress = mocCoreExpansion,
    feeFlowAddress = mocAddresses.mocFeeFlowAddress,
    mocAppreciationBeneficiaryAddress = mocAddresses.mocAppreciationBeneficiaryAddress,
    mocVendorsAddress = mocVendors,
    mocQueueAddress = mocQueue,
    protThrld = coreParams.protThrld,
    liqThrld = coreParams.liqThrld,
    feeRetainer = feeParams.feeRetainer,
    tcMintFee = feeParams.mintFee,
    tcRedeemFee = feeParams.redeemFee,
    swapTPforTPFee = feeParams.swapTPforTPFee,
    swapTPforTCFee = feeParams.swapTPforTCFee,
    swapTCforTPFee = feeParams.swapTCforTPFee,
    redeemTCandTPFee = feeParams.redeemTCandTPFee,
    mintTCandTPFee = feeParams.mintTCandTPFee,
    feeTokenPct = feeParams.feeTokenPct,
    emaCalculationBlockSpan = coreParams.emaCalculationBlockSpan,
    bes = settlementParams.bes,
    successFee = coreParams.successFee,
    appreciationFactor = coreParams.appreciationFactor,
    tcInterestCollectorAddress = mocAddresses.tcInterestCollectorAddress,
    tcInterestRate = coreParams.tcInterestRate,
    tcInterestPaymentBlockSpan = coreParams.tcInterestPaymentBlockSpan,
    maxAbsoluteOpProviderAddress = mocAddresses.maxAbsoluteOpProviderAddress,
    maxOpDiffProviderAddress = mocAddresses.maxOpDiffProviderAddress,
    decayBlockSpan = coreParams.decayBlockSpan,
    allowDifferentRecipient = coreParams.allowDifferentRecipient,
  }: {
    mocGovernorAddress?: Address;
    mocPauserAddress?: Address;
    feeTokenAddress?: Address;
    feeTokenPriceProviderAddress?: Address;
    mocTCAddress?: Address;
    mocCoreExpansionAddress?: Address;
    feeFlowAddress?: Address;
    mocAppreciationBeneficiaryAddress?: Address;
    mocVendorsAddress?: Address;
    mocQueueAddress?: Address;
    protThrld?: BigNumberish;
    liqThrld?: BigNumberish;
    feeRetainer?: BigNumberish;
    tcMintFee?: BigNumberish;
    tcRedeemFee?: BigNumberish;
    swapTPforTPFee?: BigNumberish;
    swapTPforTCFee?: BigNumberish;
    swapTCforTPFee?: BigNumberish;
    redeemTCandTPFee?: BigNumberish;
    mintTCandTPFee?: BigNumberish;
    feeTokenPct?: BigNumberish;
    emaCalculationBlockSpan?: BigNumberish;
    bes?: BigNumberish;
    successFee?: BigNumberish;
    appreciationFactor?: BigNumberish;
    tcInterestCollectorAddress?: Address;
    tcInterestRate?: BigNumberish;
    tcInterestPaymentBlockSpan?: BigNumberish;
    maxAbsoluteOpProviderAddress?: Address;
    maxOpDiffProviderAddress?: Address;
    decayBlockSpan?: BigNumberish;
    allowDifferentRecipient?: boolean;
  } = {}) => {
    return mocCARC20.initialize({
      initializeCoreParams: {
        initializeBaseBucketParams: {
          mocQueueAddress,
          feeTokenAddress,
          feeTokenPriceProviderAddress,
          tcTokenAddress: mocTCAddress,
          mocFeeFlowAddress: feeFlowAddress,
          mocAppreciationBeneficiaryAddress,
          protThrld,
          liqThrld,
          feeRetainer,
          tcMintFee,
          tcRedeemFee,
          swapTPforTPFee,
          swapTPforTCFee,
          swapTCforTPFee,
          redeemTCandTPFee,
          mintTCandTPFee,
          feeTokenPct,
          successFee,
          appreciationFactor,
          bes,
          tcInterestCollectorAddress,
          tcInterestRate,
          tcInterestPaymentBlockSpan,
          maxAbsoluteOpProviderAddress,
          maxOpDiffProviderAddress,
          decayBlockSpan,
          allowDifferentRecipient,
        },
        governorAddress: mocGovernorAddress,
        pauserAddress: mocPauserAddress,
        mocCoreExpansion: mocCoreExpansionAddress,
        emaCalculationBlockSpan,
        mocVendors: mocVendorsAddress,
      },
      ...extraArgs,
    });
  };
}
