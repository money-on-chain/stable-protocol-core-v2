import { ethers } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import { MoCPriceProviderMock, MocRC20 } from "../../typechain";

export const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
export const BURNER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BURNER_ROLE"));

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

export async function deployPriceProvide(price: BigNumber): Promise<MoCPriceProviderMock> {
  const factory = await ethers.getContractFactory("MoCPriceProviderMock");
  return factory.deploy(price);
}
