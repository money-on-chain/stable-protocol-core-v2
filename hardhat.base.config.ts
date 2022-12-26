import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-solhint";
import "@nomicfoundation/hardhat-chai-matchers";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "hardhat-docgen";
import "hardhat-gas-reporter";
import { removeConsoleLog } from "hardhat-preprocessor";
import { HardhatUserConfig } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";
import { BigNumber } from "ethers";
import "solidity-coverage";
import "hardhat-storage-layout";
import "hardhat-erc1820";
import { Address } from "hardhat-deploy/dist/types";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const PCT_BASE = BigNumber.from((1e18).toString());
const DAY_BLOCK_SPAN = 2880;
const MONTH_BLOCK_SPAN = DAY_BLOCK_SPAN * 30;

type TPParams = {
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

type AssetParams = {
  // Asset contract address
  assetAddress: Address;
  // Asset Price Provider contract address
  priceProvider: Address;
  // Asset decimal places
  decimals: number;
};

type DeployParameters = {
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

declare module "hardhat/types/config" {
  export interface HardhatNetworkUserConfig {
    deployParameters: DeployParameters;
  }
  export interface HardhatNetworkConfig {
    deployParameters: DeployParameters;
  }
  export interface HttpNetworkConfig {
    deployParameters: DeployParameters;
  }
}

const chainIds = {
  ganache: 1337,
  goerli: 5,
  hardhat: 31337,
  kovan: 42,
  mainnet: 1,
  rinkeby: 4,
  ropsten: 3,
};

// Ensure that we have all the environment variables we need.
let mnemonic: string;
if (!process.env.MNEMONIC) {
  throw new Error("Please set your MNEMONIC in a .env file");
} else {
  mnemonic = process.env.MNEMONIC;
}

let infuraApiKey: string;
if (!process.env.INFURA_API_KEY) {
  throw new Error("Please set your INFURA_API_KEY in a .env file");
} else {
  infuraApiKey = process.env.INFURA_API_KEY;
}

const createTestnetConfig = (network: keyof typeof chainIds): NetworkUserConfig => {
  const url: string = "https://" + network + ".infura.io/v3/" + infuraApiKey;
  return {
    accounts: {
      count: 10,
      initialIndex: 0,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds[network],
    url,
  };
};

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
    otherUser: 1,
    alice: 2,
    bob: 3,
    charlie: 4,
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
        accountsBalance: "100000000000000000000000000000000000",
      },
      chainId: chainIds.hardhat,
      gasPrice: 0,
      initialBaseFeePerGas: 0,
      // TODO: remove this
      allowUnlimitedContractSize: true,
      deployParameters: {
        coreParams: {
          protThrld: PCT_BASE.mul(2), // 2
          liqThrld: PCT_BASE.mul(104).div(100), // 1.04
          emaCalculationBlockSpan: DAY_BLOCK_SPAN,
          successFee: PCT_BASE.mul(10).div(100), // 10%
          appreciationFactor: PCT_BASE.mul(50).div(100), // 50%
        },
        settlementParams: {
          bes: MONTH_BLOCK_SPAN,
        },
        feeParams: {
          feeRetainer: PCT_BASE.mul(0), // 0%
          mintFee: PCT_BASE.mul(5).div(100), // 5%
          redeemFee: PCT_BASE.mul(5).div(100), // 5%
          swapTPforTPFee: PCT_BASE.mul(1).div(100), // 1%
          swapTPforTCFee: PCT_BASE.mul(1).div(100), // 1%
          swapTCforTPFee: PCT_BASE.mul(1).div(100), // 1%
          redeemTCandTPFee: PCT_BASE.mul(8).div(100), // 8%
          mintTCandTPFee: PCT_BASE.mul(8).div(100), // 8%
        },
        ctParams: {
          name: "CollateralToken",
          symbol: "CT",
        },
        mocAddresses: {
          governorAddress: "0x26a00af444928d689dDEc7B4D17C0e4A8c9D407A",
          pauserAddress: "0x26a00aF444928D689DDec7B4D17C0e4a8c9d407b",
          mocFeeFlowAddress: "0x26a00aF444928d689DDEC7b4D17c0E4a8c9D407d",
          mocAppreciationBeneficiaryAddress: "0x26A00aF444928D689ddEC7B4D17C0E4A8C9d407F",
        },
      },
      tags: ["local"],
    },
    goerli: createTestnetConfig("goerli"),
    kovan: createTestnetConfig("kovan"),
    rinkeby: createTestnetConfig("rinkeby"),
    ropsten: createTestnetConfig("ropsten"),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.16",
    settings: {
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: process.env.VIA_IR ? true : false,
      outputSelection: {
        "*": {
          "*": ["storageLayout"],
        },
      },
    },
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
    alwaysGenerateOverloads: false,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: "USD",
    gasPrice: 21,
  },
  preprocess: {
    eachLine: removeConsoleLog(hre => !["hardhat", "localhost"].includes(hre.network.name)),
  },
  docgen: {
    path: "./docs",
    clear: true,
    runOnCompile: false,
    except: ["^contracts/echidna/", "^contracts/mocks/"],
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  mocha: {
    timeout: 100000,
  },
};

export default config;
