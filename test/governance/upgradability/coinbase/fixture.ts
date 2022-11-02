import { deployments, getNamedAccounts, network } from "hardhat";
import { Contract } from "ethers";
import { MocCACoinbase, MocCACoinbase__factory } from "../../../../typechain";
import { waitForTxConfirmation, GAS_LIMIT_PATCH } from "../../../../scripts/utils";
import { coreParams, tcParams, mocAddresses } from "../../../../deploy-config/config";
import { deployAeropagusGovernor } from "../../../helpers/utils";

export function fixtureDeployGovernance(): () => Promise<{
  governor: Contract;
  mocCACoinbase: MocCACoinbase;
}> {
  return deployments.createFixture(async ({ ethers }) => {
    await deployments.fixture();
    const networkName = network.name as keyof typeof mocAddresses;
    const { deployer } = await getNamedAccounts();

    // deploy and initialize governor
    const [mocFactory, erc1967ProxyProxyFactory] = await Promise.all([
      ethers.getContractFactory("MocCACoinbase"),
      ethers.getContractFactory("ERC1967Proxy"),
    ]);
    const mocImpl = await mocFactory.deploy();
    const deployMocProxy = await erc1967ProxyProxyFactory.deploy(mocImpl.address, "0x");
    const mocCACoinbase = MocCACoinbase__factory.connect(deployMocProxy.address, ethers.provider.getSigner());

    const governor = await deployAeropagusGovernor(deployer);

    const mocTCFactory = await ethers.getContractFactory("MocTC");
    const mocTC = await mocTCFactory.deploy("mocCT", "CT", deployMocProxy.address);

    const mockAddress = deployer;
    let { pauserAddress, mocFeeFlowAddress, mocInterestCollectorAddress, mocAppreciationBeneficiaryAddress } =
      mocAddresses[networkName];
    // TODO: fix these mockAddresses
    // initializations
    await waitForTxConfirmation(
      mocCACoinbase.initialize(
        {
          initializeBaseBucketParams: {
            tcTokenAddress: mocTC.address,
            mocSettlementAddress: mockAddress,
            mocFeeFlowAddress: mocFeeFlowAddress,
            mocInterestCollectorAddress: mocInterestCollectorAddress,
            mocAppreciationBeneficiaryAddress: mocAppreciationBeneficiaryAddress,
            protThrld: coreParams.protThrld,
            liqThrld: coreParams.liqThrld,
            tcMintFee: tcParams.mintFee,
            tcRedeemFee: tcParams.redeemFee,
            successFee: coreParams.successFee,
            appreciationFactor: coreParams.appreciationFactor,
          },
          governorAddress: governor.address,
          pauserAddress: pauserAddress,
          emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
        },
        { gasLimit: GAS_LIMIT_PATCH },
      ),
    );

    return {
      governor,
      mocCACoinbase,
    };
  });
}
