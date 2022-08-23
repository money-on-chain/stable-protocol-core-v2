import { deployments } from "hardhat";
import { MocCACoinbase, MocCACoinbase__factory, MocRC20, MocRC20__factory } from "../../typechain";
import { MINTER_ROLE, BURNER_ROLE, pEth, deployPeggedToken, deployPriceProvide } from "../helpers/utils";
import { tpParams } from "../../deploy-config/config";

export function fixtureDeployedMocCoinbase(amountPegTokens: number): () => Promise<{
  mocCore: MocCACoinbase;
  mocCollateralToken: MocRC20;
  mocPeggedTokens: MocRC20[];
}> {
  return deployments.createFixture(async ({ ethers }) => {
    await deployments.fixture();
    const signer = ethers.provider.getSigner();

    const deployedMocContract = await deployments.getOrNull("MocCACoinbase");
    if (deployedMocContract == undefined) throw new Error("No Moc deployed.");
    const mocCore: MocCACoinbase = MocCACoinbase__factory.connect(deployedMocContract.address, signer);

    const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbase");
    if (deployedTCContract == undefined) throw new Error("No CollateralToken deployed.");
    const mocCollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

    const deployerAddress = await ethers.provider.getSigner().getAddress();

    const mocPeggedTokens: Array<MocRC20> = [];
    for (let i = 1; i <= amountPegTokens; i++) {
      const peggedToken = await deployPeggedToken();
      await peggedToken.grantRole(MINTER_ROLE, deployedMocContract.address);
      await peggedToken.renounceRole(MINTER_ROLE, deployerAddress);
      await peggedToken.grantRole(BURNER_ROLE, deployedMocContract.address);
      await peggedToken.renounceRole(BURNER_ROLE, deployerAddress);

      const priceProvider = await deployPriceProvide(pEth(1));
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
    };
  });
}
