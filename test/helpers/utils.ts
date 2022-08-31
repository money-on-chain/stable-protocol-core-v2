import { ethers, getNamedAccounts } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import { ERC20Mock, PriceProviderMock, MocRC20, MocCore } from "../../typechain";
import { Address } from "hardhat-deploy/types";
import { MINTER_ROLE, BURNER_ROLE } from "../../scripts/utils";
import { tpParams } from "../../deploy-config/config";

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

export async function deployAndAddPeggedTokens(
  mocImpl: MocCore,
  amountPegTokens: number,
): Promise<{ mocPeggedTokens: MocRC20[]; priceProviders: PriceProviderMock[] }> {
  const mocPeggedTokens: Array<MocRC20> = [];
  const priceProviders: Array<PriceProviderMock> = [];
  for (let i = 1; i <= amountPegTokens; i++) {
    const peggedToken = await deployPeggedToken();
    await peggedToken.grantRole(MINTER_ROLE, mocImpl.address);
    await peggedToken.grantRole(BURNER_ROLE, mocImpl.address);

    const priceProvider = await deployPriceProvider(pEth(1));
    await mocImpl.addPeggedToken(
      peggedToken.address,
      priceProvider.address,
      tpParams.r,
      tpParams.bmin,
      tpParams.mintFee,
      tpParams.redeemFee,
      tpParams.initialEma,
      tpParams.smoothingFactor,
    );
    mocPeggedTokens.push(peggedToken);
    priceProviders.push(priceProvider);
  }
  return { mocPeggedTokens, priceProviders };
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
  INSUFFICIENT_TP_TO_MINT: "InsufficientTPtoMint",
  MINT_TO_ZERO_ADDRESS: "ERC20: mint to the zero address",
  CONTRACT_INITIALIZED: "Initializable: contract is already initialized",
  ASSET_ALREADY_ADDED: "AssetAlreadyAdded",
  TRANSFER_FAIL: "TransferFailed",
  REENTRACYGUARD: "ReentrancyGuard: reentrant call",
  LOW_COVERAGE: "LowCoverage",
};

export const CONSTANTS = {
  ZERO_ADDRESS: ethers.constants.AddressZero,
  MAX_UINT256: ethers.constants.MaxUint256,
  MAX_BALANCE: ethers.constants.MaxUint256.div((1e17).toString()),
  PRECISION: BigNumber.from((1e18).toString()),
  ONE: BigNumber.from((1e18).toString()),
};
