import { deployments } from "hardhat";
import { MocCACoinbase, MocCACoinbase__factory, MocRC20, MocRC20__factory } from "../../typechain";
import { deployAndAddPeggedTokens } from "../helpers/utils";

export function fixtureDeployedMocCoinbase(amountPegTokens: number): () => Promise<{
  mocImpl: MocCACoinbase;
  mocCollateralToken: MocRC20;
  mocPeggedTokens: MocRC20[];
}> {
  return deployments.createFixture(async ({ ethers }) => {
    await deployments.fixture();
    const signer = ethers.provider.getSigner();

    const deployedMocContract = await deployments.getOrNull("MocCACoinbase");
    if (!deployedMocContract) throw new Error("No MocCACoinbase deployed.");
    const mocImpl: MocCACoinbase = MocCACoinbase__factory.connect(deployedMocContract.address, signer);

    const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbase");
    if (!deployedTCContract) throw new Error("No CollateralTokenCoinbase deployed.");
    const mocCollateralToken: MocRC20 = MocRC20__factory.connect(deployedTCContract.address, signer);

    const mocPeggedTokens = await deployAndAddPeggedTokens(mocImpl, amountPegTokens);

    return {
      mocImpl,
      mocCollateralToken,
      mocPeggedTokens,
    };
  });
}
