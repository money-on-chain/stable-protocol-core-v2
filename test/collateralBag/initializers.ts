import { MocCARC20 } from "../../typechain";
import { Address } from "hardhat-deploy/types";
import { coreParams, tcParams, mocAddresses } from "../../deploy-config/config";
import { BigNumberish } from "ethers";

const { governorAddress, stopperAddress, mocFeeFlowAddress, mocInterestCollectorAddress } = mocAddresses["hardhat"];

export function mocInitialize(mocCARC20: MocCARC20, wcaToken: Address, mocTC: Address, mocSettlement: Address) {
  return ({
    mocGovernorAddress = governorAddress,
    mocStopperAddress = stopperAddress,
    wcaTokenAddress = wcaToken,
    mocTCAddress = mocTC,
    mocSettlementAddress = mocSettlement,
    feeFlowAddress = mocFeeFlowAddress,
    interestCollectorAddress = mocInterestCollectorAddress,
    ctarg = coreParams.ctarg,
    protThrld = coreParams.protThrld,
    liqThrld = coreParams.liqThrld,
    tcMintFee = tcParams.mintFee,
    tcRedeemFee = tcParams.redeemFee,
    emaCalculationBlockSpan = coreParams.emaCalculationBlockSpan,
  }: {
    mocGovernorAddress?: Address;
    mocStopperAddress?: Address;
    wcaTokenAddress?: Address;
    mocTCAddress?: Address;
    mocSettlementAddress?: Address;
    feeFlowAddress?: Address;
    interestCollectorAddress?: Address;
    ctarg?: BigNumberish;
    protThrld?: BigNumberish;
    liqThrld?: BigNumberish;
    tcMintFee?: BigNumberish;
    tcRedeemFee?: BigNumberish;
    emaCalculationBlockSpan?: BigNumberish;
  } = {}) => {
    return mocCARC20.initialize({
      governorAddress: mocGovernorAddress,
      stopperAddress: mocStopperAddress,
      acTokenAddress: wcaTokenAddress,
      tcTokenAddress: mocTCAddress,
      mocSettlementAddress,
      mocFeeFlowAddress: feeFlowAddress,
      mocInterestCollectorAddress: interestCollectorAddress,
      ctarg,
      protThrld,
      liqThrld,
      tcMintFee,
      tcRedeemFee,
      emaCalculationBlockSpan,
    });
  };
}
