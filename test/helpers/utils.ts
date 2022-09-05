import { ethers, getNamedAccounts } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import { ERC20Mock, PriceProviderMock, MocRC20 } from "../../typechain";
import { Address } from "hardhat-deploy/types";
import { IGovernor } from "../../typechain/contracts/interfaces/IGovernor";
import { IGovernor__factory } from "../../typechain/factories/contracts/interfaces/IGovernor__factory";
import GovernorCompiled from "../governance/aeropagusImports/Governor.json";

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

export async function deployAeropagusGovernor(deployer: Address): Promise<IGovernor> {
  const factory = await ethers.getContractFactory(GovernorCompiled.abi, GovernorCompiled.bytecode);
  const governor = await factory.deploy();
  await governor.functions["initialize(address)"](deployer);
  return IGovernor__factory.connect(governor.address, ethers.provider.getSigner());
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
  ASSET_ALREADY_ADDED: "AssetAlreadyAdded",
  CONTRACT_INITIALIZED: "Initializable: contract is already initialized",
  INSUFFICIENT_QAC_SENT: "InsufficientQacSent",
  INVALID_ADDRESS: "InvalidAddress",
  INVALID_VALUE: "InvalidValue",
  MINT_TO_ZERO_ADDRESS: "ERC20: mint to the zero address",
  NOT_AUTH_CHANGER: "NotAuthorizedChanger",
  REENTRACYGUARD: "ReentrancyGuard: reentrant call",
  TRANSFER_FAIL: "TransferFailed",
};

export const CONSTANTS = {
  ZERO_ADDRESS: ethers.constants.AddressZero,
  MAX_UINT256: ethers.constants.MaxUint256,
  MAX_BALANCE: ethers.constants.MaxUint256.div((1e17).toString()),
  PRECISION: BigNumber.from((1e18).toString()),
  ONE: BigNumber.from((1e18).toString()),
};
