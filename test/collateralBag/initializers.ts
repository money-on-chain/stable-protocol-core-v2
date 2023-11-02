import hre from "hardhat";
import { Address } from "hardhat-deploy/types";
import { BigNumberish } from "ethers";
import { MocCARC20 } from "../../typechain";
import { getNetworkDeployParams } from "../../scripts/utils";

const { coreParams, feeParams, settlementParams, mocAddresses } = getNetworkDeployParams(hre);

export function mocInitialize(
  mocCARC20: MocCARC20,
  wcaToken: Address,
  mocTC: Address,
  mocCoreExpansion: Address,
  mocVendors: Address,
) {
  return ({
    mocGovernorAddress = mocAddresses.governorAddress,
    mocPauserAddress = mocAddresses.pauserAddress,
    feeTokenAddress = mocAddresses.feeTokenAddress,
    feeTokenPriceProviderAddress = mocAddresses.feeTokenPriceProviderAddress,
    wcaTokenAddress = wcaToken,
    mocTCAddress = mocTC,
    mocCoreExpansionAddress = mocCoreExpansion,
    feeFlowAddress = mocAddresses.mocFeeFlowAddress,
    mocAppreciationBeneficiaryAddress = mocAddresses.mocAppreciationBeneficiaryAddress,
    mocVendorsAddress = mocVendors,
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
  }: {
    mocGovernorAddress?: Address;
    mocPauserAddress?: Address;
    feeTokenAddress?: Address;
    feeTokenPriceProviderAddress?: Address;
    wcaTokenAddress?: Address;
    mocTCAddress?: Address;
    mocCoreExpansionAddress?: Address;
    feeFlowAddress?: Address;
    mocAppreciationBeneficiaryAddress?: Address;
    mocVendorsAddress?: Address;
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
  } = {}) => {
    return mocCARC20.initialize({
      initializeCoreParams: {
        initializeBaseBucketParams: {
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
        },
        governorAddress: mocGovernorAddress,
        pauserAddress: mocPauserAddress,
        mocCoreExpansion: mocCoreExpansionAddress,
        emaCalculationBlockSpan,
        mocVendors: mocVendorsAddress,
      },
      acTokenAddress: wcaTokenAddress,
    });
  };
}
