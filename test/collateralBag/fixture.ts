import { deployments } from "hardhat";
import {
  ERC20Mock,
  MocCARC20,
  MocCARC20__factory,
  MocCAWrapper,
  MocCAWrapper__factory,
  MocRC20,
  MocRC20__factory,
  PriceProviderMock,
} from "../../typechain";
import { pEth, deployAndAddPeggedTokens, deployPriceProvider, deployAsset } from "../helpers/utils";

export function fixtureDeployedMocCABag(amountPegTokens: number): () => Promise<{
  mocImpl: MocCARC20;
  mocWrapper: MocCAWrapper;
  mocCollateralToken: MocRC20;
  mocPeggedTokens: MocRC20[];
  priceProviders: PriceProviderMock[];
  wcaToken: MocRC20;
  asset: ERC20Mock;
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

    const deployedTCContract = await deployments.getOrNull("CollateralTokenCARBag");
    if (!deployedTCContract) throw new Error("No CollateralTokenCARBag deployed.");
    const mocCollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

    const deployedWCAContract = await deployments.getOrNull("WrappedCollateralAsset");
    if (!deployedWCAContract) throw new Error("No WrappedCollateralAsset deployed.");
    const wcaToken: MocRC20 = MocRC20__factory.connect(deployedWCAContract.address, signer);

    const { mocPeggedTokens, priceProviders } = await deployAndAddPeggedTokens(mocImpl, amountPegTokens);

    const asset = await deployAsset();
    const assetPriceProvider = await deployPriceProvider(pEth(1));
    await mocWrapper.addAsset(asset.address, assetPriceProvider.address);

    return {
      mocImpl,
      mocWrapper,
      mocCollateralToken,
      mocPeggedTokens,
      priceProviders,
      wcaToken,
      asset,
    };
  });
}
