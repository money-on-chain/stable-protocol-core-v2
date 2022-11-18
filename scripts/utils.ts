import { ContractReceipt, ContractTransaction } from "ethers";
import { HardhatNetworkUserConfig } from "hardhat/types/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";
import { coreParams, settlementParams, feeParams, mocAddresses } from "../deploy-config/config";

export const GAS_LIMIT_PATCH = 30000000;

export const waitForTxConfirmation = async (
  tx: Promise<ContractTransaction>,
  confirmations: number = 1,
): Promise<ContractReceipt> => {
  return (await tx).wait(confirmations);
};

// Note that the deployments are saved as if the network name is localhost
// See https://github.com/wighawag/hardhat-deploy#flags-1
export const getProperConfig = (hre: HardhatRuntimeEnvironment): HardhatNetworkUserConfig => {
  const network = hre.network.name === "localhost" ? "hardhat" : hre.network.name;
  return hre.config.networks[network] as HardhatNetworkUserConfig;
};

export const deployUUPSArtifact = async ({
  hre,
  artifactBaseName,
  contract,
}: {
  hre: HardhatRuntimeEnvironment;
  artifactBaseName?: string;
  contract: string;
}) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;
  artifactBaseName = artifactBaseName || contract;
  const deployImplResult = await deploy(`${artifactBaseName}Impl`, {
    contract,
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
  });
  console.log(`${contract}, as ${artifactBaseName} implementation deployed at ${deployImplResult.address}`);

  const deployProxyResult = await deploy(`${artifactBaseName}Proxy`, {
    contract: "ERC1967Proxy",
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
    args: [deployImplResult.address, "0x"],
  });
  console.log(`${artifactBaseName} ERC1967Proxy deployed at ${deployProxyResult.address}`);
};

export const getNetworkConfig = ({ network }: { network: string }) => {
  return { coreParams, settlementParams, feeParams, mocAddresses: mocAddresses[network as keyof typeof mocAddresses] };
};
