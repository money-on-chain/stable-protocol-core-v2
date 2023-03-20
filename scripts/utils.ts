import { ContractReceipt, ContractTransaction } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";
import { ethers } from "hardhat";

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
  initializeArgs,
}: {
  hre: HardhatRuntimeEnvironment;
  artifactBaseName?: string;
  contract: string;
  initializeArgs?: string[];
}) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;
  const gasLimit = getNetworkDeployParams(hre).gasLimit;
  artifactBaseName = artifactBaseName || contract;
  let execute;
  if (initializeArgs) {
    execute = {
      init: {
        methodName: "initialize",
        args: initializeArgs,
      },
    };
  }
  const deployResult = await deploy(`${artifactBaseName}Proxy`, {
    contract,
    from: deployer,
    proxy: {
      proxyContract: "UUPS",
      execute,
    },
    gasLimit,
  });
  console.log(`${contract}, as ${artifactBaseName} implementation deployed at ${deployResult.implementation}`);
  console.log(`${artifactBaseName}Proxy ERC1967Proxy deployed at ${deployResult.address}`);
};

export const deployCollateralToken = (artifactBaseName: string) => async (hre: HardhatRuntimeEnvironment) => {
  const { ctParams, mocAddresses } = getNetworkDeployParams(hre);
  const { deployer } = await hre.getNamedAccounts();

  await deployUUPSArtifact({
    hre,
    artifactBaseName,
    contract: "MocTC",
    initializeArgs: [
      ctParams.name,
      ctParams.symbol,
      deployer, // proper Moc roles are gonna be assigned after it's deployed
      mocAddresses.governorAddress,
    ],
  });

  return hre.network.live; // prevents re execution on live networks
};

export const getNetworkDeployParams = (hre: HardhatRuntimeEnvironment) => {
  const network = hre.network.name === "localhost" ? "hardhat" : hre.network.name;
  return hre.config.networks[network].deployParameters;
};

export const addPeggedTokensAndChangeGovernor = async (
  hre: HardhatRuntimeEnvironment,
  governorAddress: string,
  mocCore: any,
  tpParams: any,
) => {
  const gasLimit = getNetworkDeployParams(hre).gasLimit;
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
            gasLimit,
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
            gasLimit,
          },
        ),
      );
    }
  }
  console.log("Renouncing temp governance...");
  await waitForTxConfirmation(
    mocCore.changeGovernor(governorAddress, {
      gasLimit,
    }),
  );
  console.log(`mocCore governor is now: ${governorAddress}`);
};

export const addAssetsAndChangeGovernor = async (
  hre: HardhatRuntimeEnvironment,
  governorAddress: string,
  mocWrapper: any,
  assetParams: any,
) => {
  const gasLimit = getNetworkDeployParams(hre).gasLimit;
  if (assetParams) {
    for (let i = 0; i < assetParams.assetParams.length; i++) {
      console.log(`Adding ${assetParams.assetParams[i].assetAddress} as Asset ${i}...`);
      let priceProvider = assetParams.assetParams[i].priceProvider;
      if (assetParams.assetParams[i].decimals < 18) {
        console.log("Deploying price provider shifter");
        const shifterFactory = await ethers.getContractFactory("PriceProviderShifter");
        const shiftedPriceProvider = await shifterFactory.deploy(
          assetParams.assetParams[i].priceProvider,
          18 - assetParams.assetParams[i].decimals,
        );
        priceProvider = shiftedPriceProvider.address;
        console.log(`price provider shifter deployed at: ${priceProvider}`);
      }
      await waitForTxConfirmation(
        mocWrapper.addOrEditAsset(
          assetParams.assetParams[i].assetAddress,
          priceProvider,
          assetParams.assetParams[i].decimals,
          {
            gasLimit,
          },
        ),
      );
    }
  }
  console.log("Renouncing temp governance...");
  await waitForTxConfirmation(
    mocWrapper.changeGovernor(governorAddress, {
      gasLimit,
    }),
  );
  console.log(`MocCAWrapper governor is now: ${governorAddress}`);
};
