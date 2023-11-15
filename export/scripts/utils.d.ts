import { ContractReceipt, ContractTransaction } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";
export declare const waitForTxConfirmation: (tx: Promise<ContractTransaction>, confirmations?: number) => Promise<ContractReceipt>;
export declare const deployUUPSArtifact: ({ hre, artifactBaseName, contract, initializeArgs, }: {
    hre: HardhatRuntimeEnvironment;
    artifactBaseName?: string | undefined;
    contract: string;
    initializeArgs?: any[] | undefined;
}) => Promise<import("hardhat-deploy/dist/types").DeployResult>;
export declare const deployCollateralToken: (artifactBaseName: string) => (hre: HardhatRuntimeEnvironment) => Promise<boolean>;
export declare const getGovernorAddresses: (hre: HardhatRuntimeEnvironment) => Promise<string>;
export declare const deployVendors: (artifactBaseName: string) => (hre: HardhatRuntimeEnvironment) => Promise<boolean>;
export declare const getNetworkDeployParams: (hre: HardhatRuntimeEnvironment) => import("./types").DeployParameters;
export declare const addPeggedTokensAndChangeGovernor: (hre: HardhatRuntimeEnvironment, governorAddress: string, mocCore: any, tpParams: any) => Promise<void>;
export declare const deployCARC20: (hre: HardhatRuntimeEnvironment, mocCARC20Variant: string, ctVariant: string, extraInitParams?: {}) => Promise<import("hardhat-deploy/dist/types").DeployResult>;
