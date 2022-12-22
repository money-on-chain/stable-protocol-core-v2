import { ContractReceipt, ContractTransaction } from "ethers";
import { HardhatNetworkUserConfig } from "hardhat/types/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";

export const GAS_LIMIT_PATCH = 30000000;

export const waitForTxConfirmation = async (
  tx: Promise<ContractTransaction>,
  confirmations: number = 1,
): Promise<ContractReceipt> => {
  return (await tx).wait(confirmations);
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

export const getNetworkConfig = (hre: HardhatRuntimeEnvironment): HardhatNetworkUserConfig => {
  const network = hre.network.name === "localhost" ? "hardhat" : hre.network.name;
  return hre.config.networks[network] as HardhatNetworkUserConfig;
};
