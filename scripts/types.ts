import { BigNumber } from "ethers";
import { Address } from "hardhat-deploy/dist/types";

export type TPParams = {
  // token name
  name: string;
  // token symbol
  symbol: string;
  // Pegged Token price provider contract address
  priceProvider: Address;
  // Pegged Token target coverage [PREC]
  ctarg: BigNumber;
  // additional fee pct applied on mint [PREC]
  mintFee: BigNumber;
  // additional fee pct applied on redeem [PREC]
  redeemFee: BigNumber;
  // initial Pegged Token exponential moving average [PREC]
  initialEma: BigNumber;
  // Pegged Token smoothing factor [PREC]
  smoothingFactor: BigNumber;
};

export type DeployParameters = {
  coreParams: {
    // protected coverage threshold [PREC]
    protThrld: BigNumber;
    // liquidation coverage threshold [PREC]
    liqThrld: BigNumber;
    // amount of blocks to wait for next ema calculation
    emaCalculationBlockSpan: number;
    // pct of the gain because Pegged Tokens devaluation that is transferred in Collateral Asset to Moc Fee Flow during the settlement [PREC]
    successFee: BigNumber;
    // pct of the gain because Pegged Tokens devaluation that is returned in Pegged Tokens to appreciation beneficiary during the settlement [PREC]
    appreciationFactor: BigNumber;
    // pct interest charged to TC holders on the total collateral in the protocol [PREC]
    tcInterestRate: BigNumber;
    // amount of blocks to wait for next TC interest payment
    tcInterestPaymentBlockSpan: number;
    // number of blocks that have to elapse for the linear decay factor to be 0
    decayBlockSpan: number;
  };
  settlementParams: {
    // number of blocks between settlements
    bes: number;
  };
  feeParams: {
    // pct retain on fees to be re-injected as Collateral, while paying fees with AC [PREC]
    feeRetainer: BigNumber;
    // additional fee pct applied on mint Collateral Tokens operations [PREC]
    mintFee: BigNumber;
    // additional fee pct applied on redeem Collateral Tokens operations [PREC]
    redeemFee: BigNumber;
    // additional fee pct applied on swap a Pegged Token for another Pegged Token [PREC]
    swapTPforTPFee: BigNumber;
    // additional fee pct applied on swap a Pegged Token for Collateral Token [PREC]
    swapTPforTCFee: BigNumber;
    // additional fee pct applied on swap Collateral Token for a Pegged Token [PREC]
    swapTCforTPFee: BigNumber;
    // additional fee pct applied on redeem Collateral Token and Pegged Token [PREC]
    redeemTCandTPFee: BigNumber;
    // additional fee pct applied on mint Collateral Token and Pegged Token [PREC]
    mintTCandTPFee: BigNumber;
    // pct applied on the top of the operation`s fee when using Fee Token as fee payment method [PREC]
    // e.g. if tcMintFee = 1%, feeTokenPct = 50% => qFeeToken = 0.5%
    feeTokenPct: BigNumber;
  };
  ctParams: {
    // collateral token name
    name: string;
    // collateral token symbols
    symbol: string;
  };
  // only for initialization in testnet
  tpParams?: {
    tpParams: TPParams[];
  };
  mocAddresses: {
    // collateral asset token address, only used for RC20 implementation
    collateralAssetAddress?: Address;
    // the address that will define when a change contract is authorized
    governorAddress: Address;
    // the address that is authorized to pause this contract
    pauserAddress: Address;
    // the Fee Token contract address used as an alternative method for paying fees instead of collateral asset
    feeTokenAddress: Address;
    // the Fee Token price provider contract address
    feeTokenPriceProviderAddress: Address;
    // moc Fee Flow contract address
    mocFeeFlowAddress: Address;
    // moc appreciation beneficiary Address
    mocAppreciationBeneficiaryAddress: Address;
    // address authorized to change a vendor markup
    vendorsGuardianAddress: Address;
    // TC interest collector address
    tcInterestCollectorAddress: Address;
    // max absolute operation provider address
    maxAbsoluteOpProviderAddress: Address;
    // max operation difference provider address
    maxOpDiffProviderAddress: Address;
  };
  queueParams: {
    // min amount of blocks the Operation should wait in the Queue before execution
    minOperWaitingBlk: number;
    // max amount of Operations that can be executed on a single batch
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
  // gas limit applied for each tx during deployment
  // Hardhat gas limit config cannot be used because we are using ethers.js library. https://github.com/NomicFoundation/hardhat/pull/2406
  gasLimit: number;
};
