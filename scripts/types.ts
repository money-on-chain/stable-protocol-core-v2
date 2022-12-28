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

export type AssetParams = {
  // Asset contract address
  assetAddress: Address;
  // Asset Price Provider contract address
  priceProvider: Address;
  // Asset decimal places
  decimals: number;
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
  // only for initialization in testnet and for collateral bag implementation
  assetParams?: {
    assetParams: AssetParams[];
  };
  mocAddresses: {
    // the address that will define when a change contract is authorized
    governorAddress: Address;
    // the address that is authorized to pause this contract
    pauserAddress: Address;
    // moc Fee Flow contract address
    mocFeeFlowAddress: Address;
    // moc appreciation beneficiary Address
    mocAppreciationBeneficiaryAddress: Address;
  };
};
