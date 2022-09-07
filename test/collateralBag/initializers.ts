import { MocCARC20 } from "../../typechain";
import { Address } from "hardhat-deploy/types";
import { coreParams, tcParams, mocAddresses } from "../../deploy-config/config";
import { BigNumberish } from "ethers";

const { governor, stopper, mocFeeFlowAddress } = mocAddresses["hardhat"];

export function mocInitialize(mocCARC20: MocCARC20, wcaToken: Address, mocTC: Address) {
  return ({
    governorAddress = governor,
    stopperAddress = stopper,
    wcaTokenAddress = wcaToken,
    mocTCAddress = mocTC,
    feeFlowAddress = mocFeeFlowAddress,
    ctarg = coreParams.ctarg,
    protThrld = coreParams.protThrld,
    tcMintFee = tcParams.mintFee,
    tcRedeemFee = tcParams.redeemFee,
    emaCalculationBlockSpan = coreParams.emaCalculationBlockSpan,
  }: {
    governorAddress?: Address;
    stopperAddress?: Address;
    wcaTokenAddress?: Address;
    mocTCAddress?: Address;
    feeFlowAddress?: Address;
    ctarg?: BigNumberish;
    protThrld?: BigNumberish;
    tcMintFee?: BigNumberish;
    tcRedeemFee?: BigNumberish;
    emaCalculationBlockSpan?: BigNumberish;
  } = {}) => {
    return mocCARC20.initialize(
      governorAddress,
      stopperAddress,
      wcaTokenAddress,
      mocTCAddress,
      feeFlowAddress,
      ctarg,
      protThrld,
      tcMintFee,
      tcRedeemFee,
      emaCalculationBlockSpan,
    );
  };
}
