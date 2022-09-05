import { deployments, getNamedAccounts } from "hardhat";
import { Contract } from "ethers";
import { MocCAWrapper, MocCAWrapper__factory } from "../../../../typechain";
import { waitForTxConfirmation, GAS_LIMIT_PATCH } from "../../../../scripts/utils";
import { deployAeropagusGovernor } from "../../../helpers/utils";

export function fixtureDeployGovernance(): () => Promise<{
  governor: Contract;
  MocCAWrapper: MocCAWrapper;
}> {
  return deployments.createFixture(async ({ ethers }) => {
    await deployments.fixture();
    const { deployer } = await getNamedAccounts();

    // deploy and initialize governor
    const [mocFactory, erc1967ProxyProxyFactory] = await Promise.all([
      ethers.getContractFactory("MocCAWrapper"),
      ethers.getContractFactory("ERC1967Proxy"),
    ]);

    const mocImpl = await mocFactory.deploy();
    const deployMocProxy = await erc1967ProxyProxyFactory.deploy(mocImpl.address, "0x");
    const MocCAWrapper = MocCAWrapper__factory.connect(deployMocProxy.address, ethers.provider.getSigner());

    const governor = await deployAeropagusGovernor(deployer);

    const deployedMocContract = await deployments.getOrNull("MocCABagProxy");
    if (!deployedMocContract) throw new Error("No MocCABagProxy deployed.");

    const deployedTCContract = await deployments.getOrNull("CollateralTokenCARBag");
    if (!deployedTCContract) throw new Error("No CollateralTokenCARBag deployed.");

    const mockAddress = deployer;
    // initializations
    await waitForTxConfirmation(
      MocCAWrapper.initialize(governor.address, mockAddress, deployedMocContract.address, deployedTCContract.address, {
        gasLimit: GAS_LIMIT_PATCH,
      }),
    );

    return {
      governor,
      MocCAWrapper,
    };
  });
}
