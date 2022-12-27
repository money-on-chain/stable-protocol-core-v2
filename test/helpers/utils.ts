import { ethers, getNamedAccounts, network } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import { Address } from "hardhat-deploy/types";
import { mineUpTo } from "@nomicfoundation/hardhat-network-helpers";
import {
  ERC20Mock,
  MocCAWrapper,
  MocCore,
  MocRC20,
  MocRC20__factory,
  MocTC,
  ERC777Mock,
  MocTC__factory,
  PriceProviderMock,
} from "../../typechain";
import { IGovernor } from "../../typechain/contracts/interfaces/IGovernor";
import { IGovernor__factory } from "../../typechain/factories/contracts/interfaces/IGovernor__factory";
import GovernorCompiled from "../governance/aeropagusImports/Governor.json";

export const GAS_LIMIT_PATCH = 30000000;
const PCT_BASE = BigNumber.from((1e18).toString());

export const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
export const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
export const BURNER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BURNER_ROLE"));
export const PAUSER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PAUSER_ROLE"));

export function pEth(eth: string | number): BigNumber {
  let ethStr: string;
  if (typeof eth === "number") ethStr = eth.toLocaleString("fullwide", { useGrouping: false }).replace(",", ".");
  else ethStr = eth;
  return ethers.utils.parseEther(ethStr);
}

export async function deployPeggedToken({
  adminAddress,
  governorAddress,
}: {
  adminAddress: Address;
  governorAddress: Address;
}): Promise<MocRC20> {
  const factory = await ethers.getContractFactory("MocRC20");
  const mocRC20Impl = await factory.deploy();
  const erc1967ProxyFactory = await ethers.getContractFactory("ERC1967Proxy");
  const erc1967Proxy = await erc1967ProxyFactory.deploy(mocRC20Impl.address, "0x");

  const mocRC20Proxy = MocRC20__factory.connect(erc1967Proxy.address, ethers.provider.getSigner());
  await mocRC20Proxy.initialize("PeggedToken", "PeggedToken", adminAddress, governorAddress);
  return mocRC20Proxy;
}

export async function deployCollateralToken({
  adminAddress,
  governorAddress,
}: {
  adminAddress: Address;
  governorAddress: Address;
}): Promise<MocTC> {
  const mocTCFactory = await ethers.getContractFactory("MocTC");
  const newMocTCImpl = await mocTCFactory.deploy();
  const erc1967ProxyFactory = await ethers.getContractFactory("ERC1967Proxy");
  const erc1967Proxy = await erc1967ProxyFactory.deploy(newMocTCImpl.address, "0x");
  const mocTCProxy = MocTC__factory.connect(erc1967Proxy.address, ethers.provider.getSigner());
  await mocTCProxy.initialize("mocCT", "CT", adminAddress, governorAddress);
  return mocTCProxy;
}

export const tpParamsDefault = {
  price: PCT_BASE, // 1
  ctarg: PCT_BASE.mul(4), // 4
  mintFee: PCT_BASE.mul(5).div(100), // 5%
  redeemFee: PCT_BASE.mul(5).div(100), // 5%
  initialEma: PCT_BASE, // 1
  smoothingFactor: PCT_BASE.mul(47619048).div(10000000000), // 0,047619048
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
    mintFee: PCT_BASE.mul(1).div(1000), // 0.1%
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
  {
    price: pEth(5.25),
    ctarg: pEth(6),
    initialEma: pEth(5.04),
    smoothingFactor: pEth(0.05),
    mintFee: PCT_BASE.mul(1).div(1000), // 0.1%
  },
];

const getTPparams = ({
  price = tpParamsDefault.price,
  ctarg = tpParamsDefault.ctarg,
  mintFee = tpParamsDefault.mintFee,
  redeemFee = tpParamsDefault.redeemFee,
  initialEma = tpParamsDefault.initialEma,
  smoothingFactor = tpParamsDefault.smoothingFactor,
}) => {
  return {
    price,
    ctarg,
    mintFee,
    redeemFee,
    initialEma,
    smoothingFactor,
  };
};

export async function deployAndAddPeggedTokens(
  mocImpl: MocCore,
  amountPegTokens: number,
  tpParams?: any[],
): Promise<{ mocPeggedTokens: MocRC20[]; priceProviders: PriceProviderMock[] }> {
  const mocPeggedTokens: Array<MocRC20> = [];
  const priceProviders: Array<PriceProviderMock> = [];
  const governorAddress = await mocImpl.governor();
  for (let i = 0; i < amountPegTokens; i++) {
    const peggedToken = await deployPeggedToken({ adminAddress: mocImpl.address, governorAddress });
    const params = tpParams ? getTPparams(tpParams[i]) : getTPparams({});
    const priceProvider = await deployPriceProvider(params.price);
    await mocImpl.addPeggedToken({
      tpTokenAddress: peggedToken.address,
      priceProviderAddress: priceProvider.address,
      tpCtarg: params.ctarg,
      tpMintFee: params.mintFee,
      tpRedeemFee: params.redeemFee,
      tpEma: params.initialEma,
      tpEmaSf: params.smoothingFactor,
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
  await Promise.all([alice, bob, charlie].map(address => asset.mint(address, pEth(1e16))));
  return asset;
}

export async function deployAndAddAssets(
  mocWrapper: MocCAWrapper,
  amountAsset: number,
): Promise<{ assets: ERC20Mock[]; assetPriceProviders: PriceProviderMock[] }> {
  const assets: Array<ERC20Mock> = [];
  const assetPriceProviders: Array<PriceProviderMock> = [];
  for (let i = 0; i < amountAsset; i++) {
    const asset = await deployAsset();
    const priceProvider = await deployPriceProvider(pEth(1));
    await mocWrapper.addOrEditAsset(asset.address, priceProvider.address, 18);
    assets.push(asset);
    assetPriceProviders.push(priceProvider);
  }
  return { assets, assetPriceProviders };
}

export async function deployAssetERC777(): Promise<ERC777Mock> {
  const factory = await ethers.getContractFactory("ERC777Mock");
  const { deployer } = await getNamedAccounts();
  const asset = await factory.deploy([deployer]);
  return asset;
}

export async function deployAndAddAssetsERC777(
  mocWrapper: MocCAWrapper,
  amountAsset: number,
): Promise<{ assets: ERC777Mock[]; assetPriceProviders: PriceProviderMock[] }> {
  const assets: Array<ERC777Mock> = [];
  const assetPriceProviders: Array<PriceProviderMock> = [];
  for (let i = 0; i < amountAsset; i++) {
    const asset = await deployAssetERC777();
    const priceProvider = await deployPriceProvider(pEth(1));
    await mocWrapper.addOrEditAsset(asset.address, priceProvider.address, 18);
    assets.push(asset);
    assetPriceProviders.push(priceProvider);
  }
  return { assets, assetPriceProviders };
}

export type Balance = BigNumber;

export const ERRORS = {
  BURN_EXCEEDS_BALANCE: "ERC20: burn amount exceeds balance",
  CONTRACT_INITIALIZED: "Initializable: contract is already initialized",
  INVALID_ADDRESS: "InvalidAddress",
  INVALID_VALUE: "InvalidValue",
  INSUFFICIENT_QAC_SENT: "InsufficientQacSent",
  INSUFFICIENT_QTP_SENT: "InsufficientQtpSent",
  INSUFFICIENT_TP_TO_MINT: "InsufficientTPtoMint",
  INSUFFICIENT_TP_TO_REDEEM: "InsufficientTPtoRedeem",
  INSUFFICIENT_TC_TO_REDEEM: "InsufficientTCtoRedeem",
  LIQUIDATED: "Liquidated",
  LOW_COVERAGE: "LowCoverage",
  MINT_TO_ZERO_ADDRESS: "ERC20: mint to the zero address",
  MISSING_PROVIDER_PRICE: "MissingProviderPrice",
  NOT_WHEN_PAUSED: "NotWhenPaused",
  NOT_AUTH_CHANGER: "NotAuthorizedChanger",
  ONLY_PAUSER: "OnlyPauser",
  ONLY_WHILE_PAUSED: "OnlyWhilePaused",
  PEGGED_TOKEN_ALREADY_ADDED: "PeggedTokenAlreadyAdded",
  QAC_BELOW_MINIMUM: "QacBelowMinimumRequired",
  QAC_NEEDED_MUST_BE_GREATER_ZERO: "QacNeededMustBeGreaterThanZero",
  QTP_TP_MINT_MUST_BE_GREATER_ZERO: "QTPtoMintMustBeGreaterThanZero",
  QTP_BELOW_MINIMUM: "QtpBelowMinimumRequired",
  QTC_BELOW_MINIMUM: "QtcBelowMinimumRequired",
  REENTRACYGUARD: "ReentrancyGuard: reentrant call",
  TRANSFER_FAIL: "TransferFailed",
  UNSTOPPABLE: "Unstoppable",
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

export function getBlock(block: any) {
  return ethers.provider.getBlock(block);
}

export { mineUpTo };
