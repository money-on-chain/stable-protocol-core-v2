import { ContractReceipt, ContractTransaction } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";
export declare const waitForTxConfirmation: (tx: Promise<ContractTransaction>, confirmations?: number) => Promise<ContractReceipt>;
export declare const deployUUPSArtifact: ({ hre, artifactBaseName, contract, }: {
    hre: HardhatRuntimeEnvironment;
    artifactBaseName?: string | undefined;
    contract: string;
}) => Promise<void>;
export declare const getNetworkDeployParams: (hre: HardhatRuntimeEnvironment) => import("./types").DeployParameters;
export declare const addPeggedTokensAndChangeGovernor: (hre: HardhatRuntimeEnvironment, governorAddress: string, mocCore: any, tpParams: any) => Promise<void>;
export declare const addAssetsAndChangeGovernor: (hre: HardhatRuntimeEnvironment, governorAddress: string, mocWrapper: any, assetParams: any) => Promise<void>;
