import hre from "hardhat";
import { Address } from "hardhat-deploy/types";
import { BigNumberish } from "ethers";
import { MocCARC20 } from "../../typechain";
import { getNetworkDeployParams } from "../../scripts/utils";

const { coreParams, feeParams, settlementParams, mocAddresses } = getNetworkDeployParams(hre);

const { governorAddress, pauserAddress, mocFeeFlowAddress, mocAppreciationBeneficiaryAddress } = mocAddresses;

export function mocInitialize(mocCARC20: MocCARC20, wcaToken: Address, mocTC: Address, mocCoreExpansion: Address) {
  return ({
    mocGovernorAddress = governorAddress,
    mocPauserAddress = pauserAddress,
    wcaTokenAddress = wcaToken,
    mocTCAddress = mocTC,
    mocCoreExpansionAddress = mocCoreExpansion,
    feeFlowAddress = mocFeeFlowAddress,
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
    bes = settlementParams.bes,
    successFee = coreParams.successFee,
    appreciationFactor = coreParams.appreciationFactor,
  }: {
    mocGovernorAddress?: Address;
    mocPauserAddress?: Address;
    wcaTokenAddress?: Address;
    mocTCAddress?: Address;
    mocCoreExpansionAddress?: Address;
    feeFlowAddress?: Address;
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
    bes?: BigNumberish;
    successFee?: BigNumberish;
    appreciationFactor?: BigNumberish;
  } = {}) => {
    return mocCARC20.initialize({
      initializeCoreParams: {
        initializeBaseBucketParams: {
          tcTokenAddress: mocTCAddress,
          mocFeeFlowAddress: feeFlowAddress,
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
          bes,
        },
        governorAddress: mocGovernorAddress,
        pauserAddress: mocPauserAddress,
        mocCoreExpansion: mocCoreExpansionAddress,
        emaCalculationBlockSpan,
      },
      acTokenAddress: wcaTokenAddress,
    });
  };
}
