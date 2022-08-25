import { ethers } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import { ERC20Mock, MoCPriceProviderMock, MocRC20 } from "../../typechain";

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

export async function deployPriceProvider(price: BigNumber): Promise<MoCPriceProviderMock> {
  const factory = await ethers.getContractFactory("MoCPriceProviderMock");
  return factory.deploy(price);
}

export async function deployAsset(): Promise<ERC20Mock> {
  const factory = await ethers.getContractFactory("ERC20Mock");
  return factory.deploy();
}

export type Balance = BigNumber;

export const ERRORS = {
  INVALID_ADDRESS: "InvalidAddress",
  INVALID_VALUE: "InvalidValue",
  INSUFFICIENT_QAC_SENT: "InsufficientQacSent",
  MINT_TO_ZERO_ADDRESS: "ERC20: mint to the zero address",
};
