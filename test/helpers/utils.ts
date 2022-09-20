import { ethers, getNamedAccounts, network } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import { ERC20Mock, PriceProviderMock, MocRC20, MocCore } from "../../typechain";
import { Address } from "hardhat-deploy/types";
import { MINTER_ROLE, BURNER_ROLE } from "../../scripts/utils";
import { IGovernor } from "../../typechain/contracts/interfaces/IGovernor";
import { IGovernor__factory } from "../../typechain/factories/contracts/interfaces/IGovernor__factory";
import GovernorCompiled from "../governance/aeropagusImports/Governor.json";

export const GAS_LIMIT_PATCH = 30000000;
const PCT_BASE = BigNumber.from((1e18).toString());
const DAY_BLOCK_SPAN = 2880;

export function pEth(eth: string | number): BigNumber {
  let ethStr: string;
  if (typeof eth === "number") ethStr = eth.toLocaleString("fullwide", { useGrouping: false }).replace(",", ".");
  else ethStr = eth;
  return ethers.utils.parseEther(ethStr);
}

export async function deployPeggedToken(): Promise<MocRC20> {
  const factory = await ethers.getContractFactory("MocRC20");
  return factory.deploy("PeggedToken", "PeggedToken");
}

export const tpParamsDefault = {
  price: PCT_BASE, // 1
  ctarg: PCT_BASE.mul(4), // 4
  r: 0,
  bmin: DAY_BLOCK_SPAN,
  mintFee: PCT_BASE.mul(5).div(100), // 5%
  redeemFee: PCT_BASE.mul(5).div(100), // 5%
  initialEma: PCT_BASE, // 1
  smoothingFactor: PCT_BASE.mul(47619048).div(10000000000), // 0,047619048
  tils: PCT_BASE.mul(1).div(100), // 1%
  tiMin: PCT_BASE.mul(1).div(1000), // 0.1%
  tiMax: PCT_BASE.mul(10).div(100), // 10%
  abeq: PCT_BASE.mul(25).div(100), // 0.25
  facMin: PCT_BASE.mul(1).div(10), // 0.1
  facMax: PCT_BASE.mul(5).div(1), // 5
};

export const tpParams = [
  {
    price: pEth(235),
    ctarg: pEth(5),
    initialEma: pEth(212.04),
    smoothingFactor: pEth(0.05),
  },
  {
    price: pEth(5.25),
    ctarg: pEth(4),
    initialEma: pEth(5.04),
    smoothingFactor: pEth(0.05),
  },
  {
    price: pEth(934.58),
    ctarg: pEth(3.5),
    initialEma: pEth(837.33),
    smoothingFactor: pEth(0.01),
  },
  {
    price: pEth(20.1),
    ctarg: pEth(3),
    initialEma: pEth(20.23),
    smoothingFactor: pEth(0.01),
  },
];

const getTPparams = ({
  price = tpParamsDefault.price,
  ctarg = tpParamsDefault.ctarg,
  r = tpParamsDefault.r,
  bmin = tpParamsDefault.bmin,
  mintFee = tpParamsDefault.mintFee,
  redeemFee = tpParamsDefault.redeemFee,
  initialEma = tpParamsDefault.initialEma,
  smoothingFactor = tpParamsDefault.smoothingFactor,
  tils = tpParamsDefault.tils,
  tiMin = tpParamsDefault.tiMin,
  tiMax = tpParamsDefault.tiMax,
  abeq = tpParamsDefault.abeq,
  facMin = tpParamsDefault.facMin,
  facMax = tpParamsDefault.facMax,
}) => {
  return {
    price,
    ctarg,
    r,
    bmin,
    mintFee,
    redeemFee,
    initialEma,
    smoothingFactor,
    tils,
    tiMin,
    tiMax,
    abeq,
    facMin,
    facMax,
  };
};

export async function deployAndAddPeggedTokens(
  mocImpl: MocCore,
  amountPegTokens: number,
  tpParams?: any[],
): Promise<{ mocPeggedTokens: MocRC20[]; priceProviders: PriceProviderMock[] }> {
  const mocPeggedTokens: Array<MocRC20> = [];
  const priceProviders: Array<PriceProviderMock> = [];
  for (let i = 0; i < amountPegTokens; i++) {
    const peggedToken = await deployPeggedToken();
    await peggedToken.grantRole(MINTER_ROLE, mocImpl.address);
    await peggedToken.grantRole(BURNER_ROLE, mocImpl.address);
    const params = tpParams ? getTPparams(tpParams[i]) : getTPparams({});
    const priceProvider = await deployPriceProvider(params.price);
    await mocImpl.addPeggedToken({
      tpTokenAddress: peggedToken.address,
      priceProviderAddress: priceProvider.address,
      tpCtarg: params.ctarg,
      tpR: params.r,
      tpBmin: params.bmin,
      tpMintFee: params.mintFee,
      tpRedeemFee: params.redeemFee,
      tpEma: params.initialEma,
      tpEmaSf: params.smoothingFactor,
      tpTils: params.tils,
      tpTiMin: params.tiMin,
      tpTiMax: params.tiMax,
      tpAbeq: params.abeq,
      tpFacMin: params.facMin,
      tpFacMax: params.facMax,
    });
    mocPeggedTokens.push(peggedToken);
    priceProviders.push(priceProvider);
  }
  return { mocPeggedTokens, priceProviders };
}

export async function deployPriceProvider(price: BigNumber): Promise<PriceProviderMock> {
  const factory = await ethers.getContractFactory("PriceProviderMock");
  return factory.deploy(price);
}

export async function deployAeropagusGovernor(deployer: Address): Promise<IGovernor> {
  const factory = await ethers.getContractFactory(GovernorCompiled.abi, GovernorCompiled.bytecode);
  const governor = await factory.deploy();
  await governor.functions["initialize(address)"](deployer);
  return IGovernor__factory.connect(governor.address, ethers.provider.getSigner());
}

export async function deployAsset(): Promise<ERC20Mock> {
  const factory = await ethers.getContractFactory("ERC20Mock");
  const asset = await factory.deploy();
  // Fill users accounts with balance so that they can operate
  const { alice, bob, charlie } = await getNamedAccounts();
  await Promise.all([alice, bob, charlie].map(address => asset.mint(address, pEth(100000))));
  return asset;
}

export type Balance = BigNumber;

export const ERRORS = {
  ASSET_ALREADY_ADDED: "AssetAlreadyAdded",
  BURN_EXCEEDS_BALANCE: "ERC20: burn amount exceeds balance",
  CONTRACT_INITIALIZED: "Initializable: contract is already initialized",
  LIQUIDATED: "Liquidated",
  INVALID_ADDRESS: "InvalidAddress",
  INVALID_VALUE: "InvalidValue",
  INSUFFICIENT_QAC_SENT: "InsufficientQacSent",
  INSUFFICIENT_TP_TO_MINT: "InsufficientTPtoMint",
  INSUFFICIENT_TP_TO_REDEEM: "InsufficientTPtoRedeem",
  INSUFFICIENT_TC_TO_REDEEM: "InsufficientTCtoRedeem",
  QAC_BELOW_MINIMUM: "QacBelowMinimumRequired",
  MINT_TO_ZERO_ADDRESS: "ERC20: mint to the zero address",
  NOT_AUTH_CHANGER: "NotAuthorizedChanger",
  REENTRACYGUARD: "ReentrancyGuard: reentrant call",
  LOW_COVERAGE: "LowCoverage",
  TRANSFER_FAIL: "TransferFailed",
  PEGGED_TOKEN_ALREADY_ADDED: "PeggedTokenAlreadyAdded",
};

export const CONSTANTS = {
  ZERO_ADDRESS: ethers.constants.AddressZero,
  MAX_UINT256: ethers.constants.MaxUint256,
  MAX_BALANCE: ethers.constants.MaxUint256.div((1e17).toString()),
  PRECISION: BigNumber.from((1e18).toString()),
  ONE: BigNumber.from((1e18).toString()),
};

export function mineNBlocks(blocks: number, secondsPerBlock: number = 1): Promise<any> {
  return network.provider.send("hardhat_mine", ["0x" + blocks.toString(16), "0x" + secondsPerBlock.toString(16)]);
}
