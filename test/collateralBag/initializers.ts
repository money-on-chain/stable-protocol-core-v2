import { Address } from "hardhat-deploy/types";
import { BigNumberish } from "ethers";
import { MocCARC20 } from "../../typechain";
import { coreParams, feeParams, mocAddresses } from "../../deploy-config/config";

const {
  governorAddress,
  pauserAddress,
  mocFeeFlowAddress,
  mocInterestCollectorAddress,
  mocAppreciationBeneficiaryAddress,
} = mocAddresses["hardhat"];

export function mocInitialize(mocCARC20: MocCARC20, wcaToken: Address, mocTC: Address, mocSettlement: Address) {
  return ({
    mocGovernorAddress = governorAddress,
    mocPauserAddress = pauserAddress,
    wcaTokenAddress = wcaToken,
    mocTCAddress = mocTC,
    mocSettlementAddress = mocSettlement,
    feeFlowAddress = mocFeeFlowAddress,
    interestCollectorAddress = mocInterestCollectorAddress,
    appreciationBeneficiaryAddress = mocAppreciationBeneficiaryAddress,
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
    emaCalculationBlockSpan = coreParams.emaCalculationBlockSpan,
    successFee = coreParams.successFee,
    appreciationFactor = coreParams.appreciationFactor,
  }: {
    mocGovernorAddress?: Address;
    mocPauserAddress?: Address;
    wcaTokenAddress?: Address;
    mocTCAddress?: Address;
    mocSettlementAddress?: Address;
    feeFlowAddress?: Address;
    interestCollectorAddress?: Address;
    appreciationBeneficiaryAddress?: Address;
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
    emaCalculationBlockSpan?: BigNumberish;
    successFee?: BigNumberish;
    appreciationFactor?: BigNumberish;
  } = {}) => {
    return mocCARC20.initialize({
      initializeCoreParams: {
        initializeBaseBucketParams: {
          tcTokenAddress: mocTCAddress,
          mocSettlementAddress,
          mocFeeFlowAddress: feeFlowAddress,
          mocInterestCollectorAddress: interestCollectorAddress,
          mocAppreciationBeneficiaryAddress: appreciationBeneficiaryAddress,
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
          successFee,
          appreciationFactor,
        },
        governorAddress: mocGovernorAddress,
        pauserAddress: mocPauserAddress,
        emaCalculationBlockSpan,
      },
      acTokenAddress: wcaTokenAddress,
    });
  };
}
