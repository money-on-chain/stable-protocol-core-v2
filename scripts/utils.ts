import { ContractReceipt, ContractTransaction } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";
import { ethers } from "hardhat";

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

export const deployAndAddPeggedToken = async (
  hre: HardhatRuntimeEnvironment,
  governorAddress: string,
  mocCore: any,
  tpParams: any,
) => {
  if (tpParams) {
    const { deployments } = hre;
    const signer = ethers.provider.getSigner();
    for (let i = 0; i < tpParams.tpParams.length; i++) {
      await deployUUPSArtifact({ hre, artifactBaseName: tpParams.tpParams[i].name, contract: "MocRC20" });
      const mocRC20TP = await deployments.getOrNull(tpParams.tpParams[i].name + "Proxy");
      if (!mocRC20TP) throw new Error(`No ${tpParams.tpParams[i].name} deployed`);

      const mocRC20Proxy = await ethers.getContractAt("MocRC20", mocRC20TP.address, signer);
      console.log(`Initializing ${tpParams.tpParams[i].name} PeggedToken...`);
      await waitForTxConfirmation(
        mocRC20Proxy.initialize(
          tpParams.tpParams[i].name,
          tpParams.tpParams[i].symbol,
          mocCore.address,
          governorAddress,
          {
            gasLimit: GAS_LIMIT_PATCH,
          },
        ),
      );
      console.log(`Adding ${tpParams.tpParams[i].name} as PeggedToken ${i}...`);
      await waitForTxConfirmation(
        mocCore.addPeggedToken(
          {
            tpTokenAddress: mocRC20Proxy.address.toLowerCase(),
            priceProviderAddress: tpParams.tpParams[i].priceProvider,
            tpCtarg: tpParams.tpParams[i].ctarg,
            tpMintFee: tpParams.tpParams[i].mintFee,
            tpRedeemFee: tpParams.tpParams[i].redeemFee,
            tpEma: tpParams.tpParams[i].initialEma,
            tpEmaSf: tpParams.tpParams[i].smoothingFactor,
          },
          {
            gasLimit: GAS_LIMIT_PATCH,
          },
        ),
      );
    }
  }
};
