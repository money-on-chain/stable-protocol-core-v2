import { deployments, getNamedAccounts } from "hardhat";
import {
  ERC20Mock,
  ERC20Mock__factory,
  MocCARC20,
  MocCARC20__factory,
  MocRC20,
  MocRC20__factory,
  MocSettlement,
  MocSettlement__factory,
  PriceProviderMock,
} from "../../typechain";
import { deployAndAddPeggedTokens, pEth } from "../helpers/utils";

export function fixtureDeployedMocRC20(
  amountPegTokens: number,
  tpParams?: any,
): () => Promise<{
  mocImpl: MocCARC20;
  mocSettlement: MocSettlement;
  mocCollateralToken: MocRC20;
  mocPeggedTokens: MocRC20[];
  priceProviders: PriceProviderMock[];
  collateralAsset: ERC20Mock;
}> {
  return deployments.createFixture(async ({ ethers }) => {
    await deployments.fixture();
    const signer = ethers.provider.getSigner();

    const deployedMocContract = await deployments.getOrNull("MocCARC20Proxy");
    if (!deployedMocContract) throw new Error("No MocCARC20Proxy deployed.");
    const mocImpl: MocCARC20 = MocCARC20__factory.connect(deployedMocContract.address, signer);

    const deployedMocSettlementContractProxy = await deployments.getOrNull("MocSettlementCARC20Proxy");
    if (!deployedMocSettlementContractProxy) throw new Error("No MocSettlementCARC20Proxy deployed.");
    const mocSettlement: MocSettlement = MocSettlement__factory.connect(
      deployedMocSettlementContractProxy.address,
      signer,
    );

    const deployedTCContract = await deployments.getOrNull("CollateralTokenCARC20Proxy");
    if (!deployedTCContract) throw new Error("No CollateralTokenCARC20Proxy deployed.");
    const mocCollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

    const deployedERC20MockContract = await deployments.getOrNull("CollateralAssetCARC20");
    if (!deployedERC20MockContract) throw new Error("No CollateralAssetCARC20 deployed.");
    const collateralAsset: ERC20Mock = ERC20Mock__factory.connect(deployedERC20MockContract.address, signer);

    // Fill users accounts with balance so that they can operate
    const { alice, bob, charlie } = await getNamedAccounts();
    await Promise.all([alice, bob, charlie].map(address => collateralAsset.mint(address, pEth(10000000))));

    const { mocPeggedTokens, priceProviders } = await deployAndAddPeggedTokens(mocImpl, amountPegTokens, tpParams);

    return {
      mocImpl,
      mocSettlement,
      mocCollateralToken,
      mocPeggedTokens,
      priceProviders,
      collateralAsset,
    };
  });
}
