import { deployments } from "hardhat";
import {
  ERC20Mock,
  MocCARC20,
  MocCARC20__factory,
  MocCAWrapper,
  MocCAWrapper__factory,
  MocRC20,
  MocRC20__factory,
} from "../../typechain";
import { pEth, deployPeggedToken, deployPriceProvider, deployAsset } from "../helpers/utils";
import { MINTER_ROLE, BURNER_ROLE } from "../../scripts/utils";
import { tpParams } from "../../deploy-config/config";

export function fixtureDeployedMocCARBag(amountPegTokens: number): () => Promise<{
  mocCore: MocCARC20;
  mocWrapper: MocCAWrapper;
  mocCollateralToken: MocRC20;
  mocPeggedTokens: MocRC20[];
  wcaToken: MocRC20;
  asset: ERC20Mock;
}> {
  return deployments.createFixture(async ({ ethers }) => {
    await deployments.fixture();
    const signer = ethers.provider.getSigner();

    const deployedMocContract = await deployments.getOrNull("MocCARBag");
    if (!deployedMocContract) throw new Error("No MocCARBag deployed.");
    const mocCore: MocCARC20 = MocCARC20__factory.connect(deployedMocContract.address, signer);

    const deployedMocCAWrapperContract = await deployments.getOrNull("MocCAWrapper");
    if (!deployedMocCAWrapperContract) throw new Error("No MocCAWrapper deployed.");
    const mocWrapper: MocCAWrapper = MocCAWrapper__factory.connect(deployedMocCAWrapperContract.address, signer);

    const deployedTCContract = await deployments.getOrNull("CollateralTokenCARBag");
    if (!deployedTCContract) throw new Error("No CollateralTokenCARBag deployed.");
    const mocCollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

    const deployedWCAContract = await deployments.getOrNull("WrappedCollateralAsset");
    if (!deployedWCAContract) throw new Error("No WrappedCollateralAsset deployed.");
    const wcaToken: MocRC20 = MocRC20__factory.connect(deployedWCAContract.address, signer);

    const mocPeggedTokens: Array<MocRC20> = [];
    for (let i = 1; i <= amountPegTokens; i++) {
      const peggedToken = await deployPeggedToken();
      await peggedToken.grantRole(MINTER_ROLE, deployedMocContract.address);
      await peggedToken.grantRole(BURNER_ROLE, deployedMocContract.address);

      const priceProvider = await deployPriceProvider(pEth(1));
      await mocCore.addPeggedToken(
        peggedToken.address,
        priceProvider.address,
        tpParams.r,
        tpParams.bmin,
        tpParams.mintFee,
        tpParams.redeemFee,
      );
      mocPeggedTokens.push(peggedToken);
    }

    const asset = await deployAsset();
    const assetPriceProvider = await deployPriceProvider(pEth(1));
    await mocWrapper.addAsset(asset.address, assetPriceProvider.address);

    return {
      mocCore,
      mocWrapper,
      mocCollateralToken,
      mocPeggedTokens,
      wcaToken,
      asset,
    };
  });
}
