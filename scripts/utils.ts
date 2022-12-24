import { ContractReceipt, ContractTransaction } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";

export const GAS_LIMIT_PATCH = 6800000;

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

export const getNetworkDeployParams = (hre: HardhatRuntimeEnvironment) => {
  const network = hre.network.name === "localhost" ? "hardhat" : hre.network.name;
  return hre.config.networks[network].deployParameters;
};
