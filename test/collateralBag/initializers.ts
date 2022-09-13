import { MocCARC20 } from "../../typechain";
import { Address } from "hardhat-deploy/types";
import { coreParams, tcParams, mocAddresses } from "../../deploy-config/config";
import { BigNumberish } from "ethers";

const { governor, stopper, mocFeeFlowAddress, mocInterestCollectorAddress } = mocAddresses["hardhat"];

export function mocInitialize(mocCARC20: MocCARC20, wcaToken: Address, mocTC: Address, mocSettlement: Address) {
  return ({
    governorAddress = governor,
    stopperAddress = stopper,
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
    governorAddress?: Address;
    stopperAddress?: Address;
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
    return mocCARC20.initialize(
      governorAddress,
      stopperAddress,
      wcaTokenAddress,
      mocTCAddress,
      mocSettlementAddress,
      feeFlowAddress,
      interestCollectorAddress,
      ctarg,
      protThrld,
      liqThrld,
      tcMintFee,
      tcRedeemFee,
      emaCalculationBlockSpan,
    );
  };
}
