import { ContractReceipt, ContractTransaction } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";
import { ethers } from "hardhat";
import { Address } from "hardhat-deploy/types";

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
  initializeArgs?: any[];
}) => {
  const {
    deployments: { deploy },
    getNamedAccounts,
  } = hre;
  const { deployer } = await getNamedAccounts();
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
      proxyContract: "ERC1967Proxy",
      proxyArgs: ["{implementation}", "{data}"],
      execute,
    },
    gasLimit,
  });
  console.log(`${contract}, as ${artifactBaseName} implementation deployed at ${deployResult.implementation}`);
  console.log(`${artifactBaseName}Proxy ERC1967Proxy deployed at ${deployResult.address}`);
  return deployResult;
};

export const deployCollateralToken = (artifactBaseName: string) => async (hre: HardhatRuntimeEnvironment) => {
  const { ctParams } = getNetworkDeployParams(hre);
  const governorAddress = await getGovernorAddresses(hre);
  const { deployer } = await hre.getNamedAccounts();

  await deployUUPSArtifact({
    hre,
    artifactBaseName,
    contract: "MocTC",
    initializeArgs: [
      ctParams.name,
      ctParams.symbol,
      deployer, // proper Moc roles are gonna be assigned after it's deployed
      governorAddress,
    ],
  });

  return hre.network.live; // prevents re execution on live networks
};

export const getGovernorAddresses = async (hre: HardhatRuntimeEnvironment) => {
  let {
    mocAddresses: { governorAddress },
    gasLimit,
  } = getNetworkDeployParams(hre);

  // for tests only, we deploy necessary Mocks
  if (hre.network.tags.testnet || hre.network.tags.local) {
    const {
      deployments: { deploy },
      getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts();
    // GovernorMock can be re-use by all solutions, so it's deployed using "deploy"
    const deployResult = await deploy("GovernorMock", {
      contract: "GovernorMock",
      from: deployer,
      gasLimit,
    });
    governorAddress = deployResult.address;
  }
  return governorAddress;
};

export const deployVendors = (artifactBaseName: string) => async (hre: HardhatRuntimeEnvironment) => {
  let {
    mocAddresses: { pauserAddress, vendorsGuardianAddress },
  } = getNetworkDeployParams(hre);

  await deployUUPSArtifact({
    hre,
    artifactBaseName,
    contract: "MocVendors",
    initializeArgs: [vendorsGuardianAddress, await getGovernorAddresses(hre), pauserAddress],
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
    for (let i = 0; i < tpParams.tpParams.length; i++) {
      await deployUUPSArtifact({ hre, artifactBaseName: tpParams.tpParams[i].name, contract: "MocRC20" });
      const mocRC20TP = await deployments.getOrNull(tpParams.tpParams[i].name + "Proxy");
      if (!mocRC20TP) throw new Error(`No ${tpParams.tpParams[i].name} deployed`);

      const signer = ethers.provider.getSigner();
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
  mocWrapperAddress: Address,
  assetParams: any,
) => {
  const signer = ethers.provider.getSigner();
  const mocWrapper = await ethers.getContractAt("MocCAWrapper", mocWrapperAddress, signer);
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

export const deployCARC20 = async (hre: HardhatRuntimeEnvironment, mocCARC20Variant: string, ctVariant: string) => {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { coreParams, settlementParams, feeParams, tpParams, mocAddresses, gasLimit } = getNetworkDeployParams(hre);
  const signer = ethers.provider.getSigner();

  const deployedMocExpansionContract = await deployments.getOrNull("MocCARC20Expansion");
  if (!deployedMocExpansionContract) throw new Error("No MocCARC20Expansion deployed.");

  const deployedTCContract = await deployments.getOrNull(ctVariant + "Proxy");
  if (!deployedTCContract) throw new Error(`No ${ctVariant} deployed.`);
  const CollateralToken = await ethers.getContractAt("MocTC", deployedTCContract.address, signer);

  const deployedMocVendors = await deployments.getOrNull("MocVendorsCARC20Proxy");
  if (!deployedMocVendors) throw new Error("No MocVendors deployed.");

  let {
    collateralAssetAddress,
    pauserAddress,
    feeTokenAddress,
    feeTokenPriceProviderAddress,
    mocFeeFlowAddress,
    mocAppreciationBeneficiaryAddress,
    tcInterestCollectorAddress,
  } = mocAddresses;

  // for tests and testnet we deploy a Governor Mock
  const governorAddress = getGovernorAddresses(hre);

  // for tests we deploy a Collateral Asset mock, a FeeToken mock and its price provider
  if (hre.network.tags.local) {
    // use deployments.deploy to get contract in fixture using deployments.getOrNull
    const deployedERC20MockContract = await deployments.deploy("CollateralAssetCARC20", {
      contract: "ERC20Mock",
      from: deployer,
      gasLimit,
    });
    collateralAssetAddress = deployedERC20MockContract.address;

    const rc20MockFactory = await ethers.getContractFactory("ERC20Mock");
    feeTokenAddress = (await rc20MockFactory.deploy()).address;

    const priceProviderMockFactory = await ethers.getContractFactory("PriceProviderMock");
    feeTokenPriceProviderAddress = (await priceProviderMockFactory.deploy(ethers.utils.parseEther("1"))).address;
  }
  const mocCARC20 = await deployUUPSArtifact({
    hre,
    artifactBaseName: mocCARC20Variant,
    contract: mocCARC20Variant,
    initializeArgs: [
      {
        initializeCoreParams: {
          initializeBaseBucketParams: {
            feeTokenAddress,
            feeTokenPriceProviderAddress,
            tcTokenAddress: CollateralToken.address,
            mocFeeFlowAddress,
            mocAppreciationBeneficiaryAddress,
            protThrld: coreParams.protThrld,
            liqThrld: coreParams.liqThrld,
            feeRetainer: feeParams.feeRetainer,
            tcMintFee: feeParams.mintFee,
            tcRedeemFee: feeParams.redeemFee,
            swapTPforTPFee: feeParams.swapTPforTPFee,
            swapTPforTCFee: feeParams.swapTPforTCFee,
            swapTCforTPFee: feeParams.swapTCforTPFee,
            redeemTCandTPFee: feeParams.redeemTCandTPFee,
            mintTCandTPFee: feeParams.mintTCandTPFee,
            feeTokenPct: feeParams.feeTokenPct,
            successFee: coreParams.successFee,
            appreciationFactor: coreParams.appreciationFactor,
            bes: settlementParams.bes,
            tcInterestCollectorAddress,
            tcInterestRate: coreParams.tcInterestRate,
            tcInterestPaymentBlockSpan: coreParams.tcInterestPaymentBlockSpan,
          },
          governorAddress,
          pauserAddress,
          mocCoreExpansion: deployedMocExpansionContract.address,
          emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
          mocVendors: deployedMocVendors.address,
        },
        acTokenAddress: collateralAssetAddress,
      },
    ],
  });

  console.log("Delegating CT roles to Moc");
  // Assign TC Roles, and renounce deployer ADMIN
  await waitForTxConfirmation(CollateralToken.transferAllRoles(mocCARC20.address));

  console.log("initialization completed!");
  // for testnet we add some Pegged Token and then transfer governance to the real governor
  if (hre.network.tags.testnet) {
    await addPeggedTokensAndChangeGovernor(hre, mocAddresses.governorAddress, mocCARC20, tpParams);
  }

  return mocCARC20;
};
