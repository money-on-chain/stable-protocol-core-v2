import { ethers, getNamedAccounts } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import { ERC20Mock, PriceProviderMock, MocRC20 } from "../../typechain";
import { Address } from "hardhat-deploy/types";

export function pEth(eth: string | number): BigNumber {
  let ethStr: string;
  if (typeof eth === "number") ethStr = eth.toLocaleString("fullwide", { useGrouping: false });
  else ethStr = eth;
  return ethers.utils.parseEther(ethStr);
}

export async function deployPeggedToken(): Promise<MocRC20> {
  const factory = await ethers.getContractFactory("MocRC20");
  return factory.deploy("PeggedToken", "PeggedToken");
}

export async function deployPriceProvider(price: BigNumber): Promise<PriceProviderMock> {
  const factory = await ethers.getContractFactory("PriceProviderMock");
  return factory.deploy(price);
}

export async function deployAsset(): Promise<ERC20Mock> {
  let alice: Address;
  let bob: Address;
  ({ alice, bob } = await getNamedAccounts());
  const factory = await ethers.getContractFactory("ERC20Mock");
  const asset = await factory.deploy();
  await asset.mint(alice, pEth(100000));
  await asset.mint(bob, pEth(100000));
  return asset;
}

export type Balance = BigNumber;

export const ERRORS = {
  INVALID_ADDRESS: "InvalidAddress",
  INVALID_VALUE: "InvalidValue",
  INSUFFICIENT_QAC_SENT: "InsufficientQacSent",
  MINT_TO_ZERO_ADDRESS: "ERC20: mint to the zero address",
  CONTRACT_INITIALIZED: "Initializable: contract is already initialized",
  ASSET_ALREADY_ADDED: "AssetAlreadyAdded",
  TRANSFER_FAIL: "TransferFail",
};

export const CONSTANTS = {
  ZERO_ADDRESS: ethers.constants.AddressZero,
  PRECISION: BigNumber.from((1e18).toString()),
  ONE: BigNumber.from((1e18).toString()),
};
