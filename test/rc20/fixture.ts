import { deployments, getNamedAccounts } from "hardhat";
import {
  ERC20Mock,
  ERC20Mock__factory,
  MocCARC20,
  MocCARC20__factory,
  MocRC20,
  MocRC20__factory,
} from "../../typechain";
import { pEth, deployPeggedToken, deployPriceProvider } from "../helpers/utils";
import { MINTER_ROLE, BURNER_ROLE } from "../../scripts/utils";
import { tpParams } from "../../deploy-config/config";

export function fixtureDeployedMocRC20(amountPegTokens: number): () => Promise<{
  mocCore: MocCARC20;
  mocCollateralToken: MocRC20;
  mocPeggedTokens: MocRC20[];
  collateralAsset: ERC20Mock;
}> {
  return deployments.createFixture(async ({ ethers }) => {
    await deployments.fixture();
    const signer = ethers.provider.getSigner();
    let alice: string;
    ({ alice } = await getNamedAccounts());

    const deployedMocContract = await deployments.getOrNull("MocCARC20");
    if (!deployedMocContract) throw new Error("No Moc deployed.");
    const mocCore: MocCARC20 = MocCARC20__factory.connect(deployedMocContract.address, signer);

    const deployedTCContract = await deployments.getOrNull("CollateralTokenCARC20");
    if (!deployedTCContract) throw new Error("No CollateralToken deployed.");
    const mocCollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

    const deployedERC20MockContract = await deployments.getOrNull("CollateralAssetCARC20");
    if (!deployedERC20MockContract) throw new Error("No CollateralAsset deployed.");
    const collateralAsset: ERC20Mock = ERC20Mock__factory.connect(deployedERC20MockContract.address, signer);
    await collateralAsset.mint(alice, pEth(100000));

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

    return {
      mocCore,
      mocCollateralToken,
      mocPeggedTokens,
      collateralAsset,
    };
  });
}
