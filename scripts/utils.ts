import { ContractTransaction, ContractReceipt } from "ethers";
import { HardhatNetworkUserConfig } from "hardhat/types/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";

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

export const deployUUPSArtifact = async (hre: HardhatRuntimeEnvironment, artifactName: string, contract: string) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const deployImplResult = await deploy(`${artifactName}Impl`, {
    contract,
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
  });
  console.log(`${contract}, as ${artifactName} implementation deployed at ${deployImplResult.address}`);

  const deployProxyResult = await deploy(`${artifactName}Proxy`, {
    contract: "ERC1967Proxy",
    from: deployer,
    gasLimit: GAS_LIMIT_PATCH,
    args: [deployImplResult.address, "0x"],
  });
  console.log(`${artifactName} ERC1967Proxy deployed at ${deployProxyResult.address}`);
};
