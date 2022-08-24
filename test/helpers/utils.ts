import { ethers } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import { MoCPriceProviderMock, MocRC20 } from "../../typechain";

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

export type Balance = BigNumber;

export const CUSTOM_ERRORS = {
  INVALID_ADDRESS: "InvalidAddress",
  INVALID_VALUE: "InvalidValue",
  INSUFFICIENT_QAC_SENT: "InsufficientQacSent",
};
