import { ethers, getNamedAccounts, network } from "hardhat";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
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
export const EXECUTOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EXECUTOR_ROLE"));
export const ENQUEUER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ENQUEUER_ROLE"));

export enum OperType {
  none, // avoid using zero as Type
  mintTC,
  redeemTC,
  mintTP,
  redeemTP,
  mintTCandTP,
  redeemTCandTP,
  swapTCforTP,
  swapTPforTC,
  swapTPforTP,
}

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

export const ethersGetBalance = (account: Address) => ethers.provider.getBalance(account);

export const ERRORS = {
  BURN_EXCEEDS_BALANCE: "ERC20: burn amount exceeds balance",
  CONTRACT_INITIALIZED: "Initializable: contract is already initialized",
  INVALID_ADDRESS: "InvalidAddress",
  INVALID_VALUE: "InvalidValue",
  INVALID_ROLES: "InvalidRoles",
  INVALID_GOVERNOR: "InvalidGovernor",
  INSUFFICIENT_QAC_SENT: "InsufficientQacSent",
  INSUFFICIENT_QTP_SENT: "InsufficientQtpSent",
  INSUFFICIENT_TP_TO_MINT: "InsufficientTPtoMint",
  INSUFFICIENT_TP_TO_REDEEM: "InsufficientTPtoRedeem",
  INSUFFICIENT_TC_TO_REDEEM: "InsufficientTCtoRedeem",
  LIQUIDATED: "Liquidated",
  ONLY_LIQUIDATED: "OnlyWhenLiquidated",
  LOW_COVERAGE: "LowCoverage",
  MINT_TO_ZERO_ADDRESS: "ERC20: mint to the zero address",
  MISSING_PROVIDER_PRICE: "MissingProviderPrice",
  NOT_WHEN_PAUSED: "NotWhenPaused",
  NOT_AUTH_CHANGER: "NotAuthorizedChanger",
  NOT_UNIQUE_ROLE: "NotUniqueRole",
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
  MISSING_BLOCKS_TO_SETTLEMENT: "MissingBlocksToSettlement",
  MISSING_BLOCKS_TO_TC_INTEREST_PAYMENT: "MissingBlocksToTCInterestPayment",
  EXEC_FEE_PAYMENT_FAILED: "ExecutionFeePaymentFailed",
};

const getSelectorFor = (error: string) => ethers.utils.hexDataSlice(ethers.utils.id(error), 0, 4);

export const ERROR_SELECTOR = {
  LOW_COVERAGE: getSelectorFor(ERRORS.LOW_COVERAGE + "(uint256,uint256)"),
  INSUFFICIENT_QAC_SENT: getSelectorFor(ERRORS.INSUFFICIENT_QAC_SENT + "(uint256,uint256)"),
  INSUFFICIENT_TC_TO_REDEEM: getSelectorFor(ERRORS.INSUFFICIENT_TC_TO_REDEEM + "(uint256,uint256)"),
  INSUFFICIENT_TP_TO_MINT: getSelectorFor(ERRORS.INSUFFICIENT_TP_TO_MINT + "(uint256,uint256)"),
  INSUFFICIENT_TP_TO_REDEEM: getSelectorFor(ERRORS.INSUFFICIENT_TP_TO_REDEEM + "(uint256,uint256)"),
  INSUFFICIENT_QTP_SENT: getSelectorFor(ERRORS.INSUFFICIENT_QTP_SENT + "(uint256,uint256)"),
  QAC_NEEDED_MUST_BE_GREATER_ZERO: getSelectorFor(ERRORS.QAC_NEEDED_MUST_BE_GREATER_ZERO + "()"),
  QAC_BELOW_MINIMUM: getSelectorFor(ERRORS.QAC_BELOW_MINIMUM + "(uint256,uint256)"),
  QTP_BELOW_MINIMUM: getSelectorFor(ERRORS.QTP_BELOW_MINIMUM + "(uint256,uint256)"),
  QTC_BELOW_MINIMUM: getSelectorFor(ERRORS.QTC_BELOW_MINIMUM + "(uint256,uint256)"),
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

export async function ensureERC1820(): Promise<void> {
  const ERC1820_ADDRESS = "0x1820a4b7618bde71dce8cdc73aab6c95905fad24";
  const ERC1820_DEPLOYER = "0xa990077c3205cbDf861e17Fa532eeB069cE9fF96";
  const ERC1820_PAYLOAD =
    "0xf90a388085174876e800830c35008080b909e5608060405234801561001057600080fd5b506109c5806100206000396000f3fe608060405234801561001057600080fd5b50600436106100a5576000357c010000000000000000000000000000000000000000000000000000000090048063a41e7d5111610078578063a41e7d51146101d4578063aabbb8ca1461020a578063b705676514610236578063f712f3e814610280576100a5565b806329965a1d146100aa5780633d584063146100e25780635df8122f1461012457806365ba36c114610152575b600080fd5b6100e0600480360360608110156100c057600080fd5b50600160a060020a038135811691602081013591604090910135166102b6565b005b610108600480360360208110156100f857600080fd5b5035600160a060020a0316610570565b60408051600160a060020a039092168252519081900360200190f35b6100e06004803603604081101561013a57600080fd5b50600160a060020a03813581169160200135166105bc565b6101c26004803603602081101561016857600080fd5b81019060208101813564010000000081111561018357600080fd5b82018360208201111561019557600080fd5b803590602001918460018302840111640100000000831117156101b757600080fd5b5090925090506106b3565b60408051918252519081900360200190f35b6100e0600480360360408110156101ea57600080fd5b508035600160a060020a03169060200135600160e060020a0319166106ee565b6101086004803603604081101561022057600080fd5b50600160a060020a038135169060200135610778565b61026c6004803603604081101561024c57600080fd5b508035600160a060020a03169060200135600160e060020a0319166107ef565b604080519115158252519081900360200190f35b61026c6004803603604081101561029657600080fd5b508035600160a060020a03169060200135600160e060020a0319166108aa565b6000600160a060020a038416156102cd57836102cf565b335b9050336102db82610570565b600160a060020a031614610339576040805160e560020a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e616765720000000000000000000000000000000000604482015290519081900360640190fd5b6103428361092a565b15610397576040805160e560020a62461bcd02815260206004820152601a60248201527f4d757374206e6f7420626520616e204552433136352068617368000000000000604482015290519081900360640190fd5b600160a060020a038216158015906103b85750600160a060020a0382163314155b156104ff5760405160200180807f455243313832305f4143434550545f4d4147494300000000000000000000000081525060140190506040516020818303038152906040528051906020012082600160a060020a031663249cb3fa85846040518363ffffffff167c01000000000000000000000000000000000000000000000000000000000281526004018083815260200182600160a060020a0316600160a060020a031681526020019250505060206040518083038186803b15801561047e57600080fd5b505afa158015610492573d6000803e3d6000fd5b505050506040513d60208110156104a857600080fd5b5051146104ff576040805160e560020a62461bcd02815260206004820181905260248201527f446f6573206e6f7420696d706c656d656e742074686520696e74657266616365604482015290519081900360640190fd5b600160a060020a03818116600081815260208181526040808320888452909152808220805473ffffffffffffffffffffffffffffffffffffffff19169487169485179055518692917f93baa6efbd2244243bfee6ce4cfdd1d04fc4c0e9a786abd3a41313bd352db15391a450505050565b600160a060020a03818116600090815260016020526040812054909116151561059a5750806105b7565b50600160a060020a03808216600090815260016020526040902054165b919050565b336105c683610570565b600160a060020a031614610624576040805160e560020a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e616765720000000000000000000000000000000000604482015290519081900360640190fd5b81600160a060020a031681600160a060020a0316146106435780610646565b60005b600160a060020a03838116600081815260016020526040808220805473ffffffffffffffffffffffffffffffffffffffff19169585169590951790945592519184169290917f605c2dbf762e5f7d60a546d42e7205dcb1b011ebc62a61736a57c9089d3a43509190a35050565b600082826040516020018083838082843780830192505050925050506040516020818303038152906040528051906020012090505b92915050565b6106f882826107ef565b610703576000610705565b815b600160a060020a03928316600081815260208181526040808320600160e060020a031996909616808452958252808320805473ffffffffffffffffffffffffffffffffffffffff19169590971694909417909555908152600284528181209281529190925220805460ff19166001179055565b600080600160a060020a038416156107905783610792565b335b905061079d8361092a565b156107c357826107ad82826108aa565b6107b85760006107ba565b815b925050506106e8565b600160a060020a0390811660009081526020818152604080832086845290915290205416905092915050565b6000808061081d857f01ffc9a70000000000000000000000000000000000000000000000000000000061094c565b909250905081158061082d575080155b1561083d576000925050506106e8565b61084f85600160e060020a031961094c565b909250905081158061086057508015155b15610870576000925050506106e8565b61087a858561094c565b909250905060018214801561088f5750806001145b1561089f576001925050506106e8565b506000949350505050565b600160a060020a0382166000908152600260209081526040808320600160e060020a03198516845290915281205460ff1615156108f2576108eb83836107ef565b90506106e8565b50600160a060020a03808316600081815260208181526040808320600160e060020a0319871684529091529020549091161492915050565b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff161590565b6040517f01ffc9a7000000000000000000000000000000000000000000000000000000008082526004820183905260009182919060208160248189617530fa90519096909550935050505056fea165627a7a72305820377f4a2d4301ede9949f163f319021a6e9c687c292a5e2b2c4734c126b524e6c00291ba01820182018201820182018201820182018201820182018201820182018201820a01820182018201820182018201820182018201820182018201820182018201820";

  const code = await ethers.provider.send("eth_getCode", [ERC1820_ADDRESS, "latest"]);
  if (code === "0x") {
    const [from] = await ethers.provider.send("eth_accounts", []);

    await ethers.provider.send("eth_sendTransaction", [
      {
        from,
        to: ERC1820_DEPLOYER,
        value: "0x11c37937e080000",
      },
    ]);

    await ethers.provider.send("eth_sendRawTransaction", [ERC1820_PAYLOAD]);
  }
}

export function expectEventFor(mocImpl: any, mocFunctions: any, eventName: string): any {
  return async (tx: ContractTransaction, rawArgs: any[]) => {
    let args = rawArgs;
    if (mocFunctions.getEventArgs) {
      args = mocFunctions.getEventArgs(args);
    }
    await expect(tx)
      .to.emit(mocFunctions.getEventSource ? mocFunctions.getEventSource() : mocImpl, eventName)
      .withArgs(...args);
  };
}

export { mineUpTo };
