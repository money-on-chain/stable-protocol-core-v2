import { MocCARC20 } from "../../typechain";
import { Address } from "hardhat-deploy/types";
import { coreParams, tcParams, mocAddresses } from "../../deploy-config/config";
import { BigNumberish } from "ethers";

const { governorAddress, stopperAddress, mocFeeFlowAddress, mocInterestCollectorAddress, mocTurboAddress } =
  mocAddresses["hardhat"];

export function mocInitialize(mocCARC20: MocCARC20, wcaToken: Address, mocTC: Address, mocSettlement: Address) {
  return ({
    mocGovernorAddress = governorAddress,
    mocStopperAddress = stopperAddress,
    wcaTokenAddress = wcaToken,
    mocTCAddress = mocTC,
    mocSettlementAddress = mocSettlement,
    feeFlowAddress = mocFeeFlowAddress,
    interestCollectorAddress = mocInterestCollectorAddress,
    turboAddress = mocTurboAddress,
    protThrld = coreParams.protThrld,
    liqThrld = coreParams.liqThrld,
    tcMintFee = tcParams.mintFee,
    tcRedeemFee = tcParams.redeemFee,
    emaCalculationBlockSpan = coreParams.emaCalculationBlockSpan,
    sf = coreParams.sf,
    fa = coreParams.fa,
  }: {
    mocGovernorAddress?: Address;
    mocStopperAddress?: Address;
    wcaTokenAddress?: Address;
    mocTCAddress?: Address;
    mocSettlementAddress?: Address;
    feeFlowAddress?: Address;
    interestCollectorAddress?: Address;
    turboAddress?: Address;
    protThrld?: BigNumberish;
    liqThrld?: BigNumberish;
    tcMintFee?: BigNumberish;
    tcRedeemFee?: BigNumberish;
    emaCalculationBlockSpan?: BigNumberish;
    sf?: BigNumberish;
    fa?: BigNumberish;
  } = {}) => {
    return mocCARC20.initialize({
      initializeCoreParams: {
        initializeBaseBucketParams: {
          tcTokenAddress: mocTCAddress,
          mocSettlementAddress,
          mocFeeFlowAddress: feeFlowAddress,
          mocInterestCollectorAddress: interestCollectorAddress,
          mocTurboAddress: turboAddress,
          protThrld,
          liqThrld,
          tcMintFee,
          tcRedeemFee,
          sf,
          fa,
        },
        governorAddress: mocGovernorAddress,
        stopperAddress: mocStopperAddress,
        emaCalculationBlockSpan,
      },
      acTokenAddress: wcaTokenAddress,
    });
  };
}
