import { deployments } from "hardhat";
import {
  ERC20Mock,
  MocCARC20,
  MocCARC20__factory,
  MocCAWrapper,
  MocCAWrapper__factory,
  MocRC20,
  MocRC20__factory,
  MocSettlement,
  MocSettlement__factory,
  PriceProviderMock,
} from "../../typechain";
import { deployAndAddPeggedTokens, deployAndAddAssets } from "../helpers/utils";

export function fixtureDeployedMocCABag(
  amountPegTokens: number,
  tpParams?: any,
  amountAssets = 1,
): () => Promise<{
  mocImpl: MocCARC20;
  mocWrapper: MocCAWrapper;
  mocSettlement: MocSettlement;
  mocCollateralToken: MocRC20;
  mocPeggedTokens: MocRC20[];
  priceProviders: PriceProviderMock[];
  wcaToken: MocRC20;
  assets: ERC20Mock[];
  assetPriceProviders: PriceProviderMock[];
}> {
  return deployments.createFixture(async ({ ethers }) => {
    await deployments.fixture();
    const signer = ethers.provider.getSigner();

    const deployedMocContract = await deployments.getOrNull("MocCABagProxy");
    if (!deployedMocContract) throw new Error("No MocCABagProxy deployed.");
    const mocImpl: MocCARC20 = MocCARC20__factory.connect(deployedMocContract.address, signer);

    const deployedMocCAWrapperContract = await deployments.getOrNull("MocCAWrapperProxy");
    if (!deployedMocCAWrapperContract) throw new Error("No MocCAWrapper deployed.");
    const mocWrapper: MocCAWrapper = MocCAWrapper__factory.connect(deployedMocCAWrapperContract.address, signer);

    const deployedMocSettlementContractProxy = await deployments.getOrNull("MocSettlementCABagProxy");
    if (!deployedMocSettlementContractProxy) throw new Error("No MocSettlementCABagProxy deployed.");
    const mocSettlement: MocSettlement = MocSettlement__factory.connect(
      deployedMocSettlementContractProxy.address,
      signer,
    );

    const deployedTCContract = await deployments.getOrNull("CollateralTokenCARBag");
    if (!deployedTCContract) throw new Error("No CollateralTokenCARBag deployed.");
    const mocCollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

    const deployedWCAContract = await deployments.getOrNull("WrappedCollateralAsset");
    if (!deployedWCAContract) throw new Error("No WrappedCollateralAsset deployed.");
    const wcaToken: MocRC20 = MocRC20__factory.connect(deployedWCAContract.address, signer);

    const { mocPeggedTokens, priceProviders } = await deployAndAddPeggedTokens(mocImpl, amountPegTokens, tpParams);

    const { assets, assetPriceProviders } = await deployAndAddAssets(mocWrapper, amountAssets);

    return {
      mocImpl,
      mocWrapper,
      mocSettlement,
      mocCollateralToken,
      mocPeggedTokens,
      priceProviders,
      wcaToken,
      assets,
      assetPriceProviders,
    };
  });
}
