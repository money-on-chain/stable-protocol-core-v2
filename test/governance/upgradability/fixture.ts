import { deployments, getNamedAccounts, network } from "hardhat";
import { Contract } from "ethers";
import { MocCACoinbase, MocCACoinbase__factory } from "../../../typechain";
import GovernorCompiled from "../aeropagusImports/Governor.json";
import { waitForTxConfirmation, GAS_LIMIT_PATCH } from "../../../scripts/utils";
import { coreParams, tcParams, mocAddresses } from "../../../deploy-config/config";

export function fixtureDeployGovernance(): () => Promise<{
  governor: Contract;
  mocCACoinbase: MocCACoinbase;
}> {
  return deployments.createFixture(async ({ ethers }) => {
    await deployments.fixture();
    const networkName = network.name as keyof typeof mocAddresses;
    const { deployer } = await getNamedAccounts();

    const deployedTCContract = await deployments.getOrNull("CollateralTokenCoinbase");
    if (!deployedTCContract) throw new Error("No CollateralTokenCoinbase deployed.");

    // deploy and initialize governor
    const [governorFactory, mocFactory, erc1967ProxyProxyFactory] = await Promise.all([
      ethers.getContractFactory(GovernorCompiled.abi, GovernorCompiled.bytecode),
      ethers.getContractFactory("MocCACoinbase"),
      ethers.getContractFactory("ERC1967Proxy"),
    ]);

    const governor = await governorFactory.deploy();
    await governor.functions["initialize(address)"](deployer);

    const mocImpl = await mocFactory.deploy();
    const deployMocProxy = await erc1967ProxyProxyFactory.deploy(mocImpl.address, "0x");
    const mocCACoinbase = MocCACoinbase__factory.connect(deployMocProxy.address, ethers.provider.getSigner());

    // initializations
    await waitForTxConfirmation(
      mocCACoinbase.initialize(
        governor.address,
        deployer, // TODO: stopper
        deployedTCContract.address,
        mocAddresses[networkName].mocFeeFlowAddress,
        coreParams.ctarg,
        coreParams.protThrld,
        tcParams.mintFee,
        tcParams.redeemFee,
        { gasLimit: GAS_LIMIT_PATCH },
      ),
    );

    return {
      governor,
      mocCACoinbase,
    };
  });
}
