import { deployments } from "hardhat";
import { MocCACoinbase, MocCACoinbase__factory, MocRC20, MocRC20__factory } from "../../typechain";
import { pEth, deployPeggedToken, deployPriceProvider } from "../helpers/utils";
import { MINTER_ROLE, BURNER_ROLE } from "../../scripts/utils";
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
    if (!deployedMocContract) throw new Error("No Moc deployed.");
    const mocCore: MocCACoinbase = MocCACoinbase__factory.connect(deployedMocContract.address, signer);

    const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbase");
    if (!deployedTCContract) throw new Error("No CollateralToken deployed.");
    const mocCollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

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
    };
  });
}
