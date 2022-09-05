import { deployments, getNamedAccounts, network } from "hardhat";
import { Contract } from "ethers";
import { MocCARC20, MocCARC20__factory } from "../../../../typechain";
import { waitForTxConfirmation, GAS_LIMIT_PATCH } from "../../../../scripts/utils";
import { coreParams, tcParams, mocAddresses } from "../../../../deploy-config/config";
import { deployAeropagusGovernor } from "../../../helpers/utils";

export function fixtureDeployGovernance(): () => Promise<{
  governor: Contract;
  mocCARC20: MocCARC20;
}> {
  return deployments.createFixture(async ({ ethers }) => {
    await deployments.fixture();
    const networkName = network.name as keyof typeof mocAddresses;
    const { deployer } = await getNamedAccounts();

    // deploy and initialize governor
    const [mocFactory, erc1967ProxyProxyFactory] = await Promise.all([
      ethers.getContractFactory("MocCARC20"),
      ethers.getContractFactory("ERC1967Proxy"),
    ]);

    const mocImpl = await mocFactory.deploy();
    const deployMocProxy = await erc1967ProxyProxyFactory.deploy(mocImpl.address, "0x");
    const mocCARC20 = MocCARC20__factory.connect(deployMocProxy.address, ethers.provider.getSigner());

    const governor = await deployAeropagusGovernor(deployer);

    const mockAddress = deployer;
    // initializations
    await waitForTxConfirmation(
      mocCARC20.initialize(
        governor.address,
        mockAddress,
        mockAddress,
        mockAddress,
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
      mocCARC20,
    };
  });
}