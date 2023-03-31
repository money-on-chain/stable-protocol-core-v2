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
import { DeployParameters } from "./scripts/types";
import "hardhat-storage-layout-diff";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const PCT_BASE = BigNumber.from((1e18).toString());
const DAY_BLOCK_SPAN = 2880;
const WEEK_BLOCK_SPAN = DAY_BLOCK_SPAN * 7;
const MONTH_BLOCK_SPAN = DAY_BLOCK_SPAN * 30;

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
    vendor: 5,
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
          tcInterestRate: PCT_BASE.mul(5).div(100000), // 0.005% : weekly 0.0025 / 365 * 7
          tcInterestPaymentBlockSpan: WEEK_BLOCK_SPAN,
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
          feeTokenPct: PCT_BASE.mul(5).div(10), // 50%
        },
        ctParams: {
          name: "CollateralToken",
          symbol: "CT",
        },
        mocAddresses: {
          governorAddress: "0x26a00af444928d689dDEc7B4D17C0e4A8c9D407A",
          pauserAddress: "0x26a00aF444928D689DDec7B4D17C0e4a8c9d407b",
          feeTokenAddress: "0x26a00AF444928d689DDeC7b4d17c0e4A8c9D4060",
          feeTokenPriceProviderAddress: "0x26A00AF444928d689ddec7b4d17c0E4A8C9D4061",
          mocFeeFlowAddress: "0x26a00aF444928d689DDEC7b4D17c0E4a8c9D407d",
          mocAppreciationBeneficiaryAddress: "0x26A00aF444928D689ddEC7B4D17C0E4A8C9d407F",
          vendorsGuardianAddress: "0x26a00AF444928D689DDeC7b4D17c0E4a8C9d407E",
          tcInterestCollectorAddress: "0x27a00Af444928D689DDec7B4D17c0E4a8c9d407F",
        },
        gasLimit: 30000000, // high value to avoid coverage issue. https://github.com/NomicFoundation/hardhat/issues/3121
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
        details: {
          yulDetails: {
            // solves viaIR issue that inline internal functions: https://github.com/ethereum/solidity/issues/13858#issuecomment-1428754261
            optimizerSteps:
              "dhfoDgvulfnTUtnIf[xa[r]EscLMcCTUtTOntnfDIulLculVcul[j]Tpeulxa[rul]xa[r]cLgvifCTUca[r]LSsTOtfDnca[r]Iulc]jmul[jul]VcTOculjmul",
          },
        },
      },
      viaIR: process.env.VIA_IR === undefined ? true : process.env.VIA_IR == "true",
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
