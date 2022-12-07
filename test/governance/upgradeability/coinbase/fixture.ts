import { deployments, getNamedAccounts } from "hardhat";
import { Contract } from "ethers";
import { MocCACoinbase, MocCACoinbase__factory } from "../../../../typechain";
import { GAS_LIMIT_PATCH, getNetworkConfig, waitForTxConfirmation } from "../../../../scripts/utils";
import { deployAeropagusGovernor, deployCollateralToken } from "../../../helpers/utils";

const { coreParams, feeParams, settlementParams, mocAddresses } = getNetworkConfig({ network: "hardhat" });

export function fixtureDeployGovernance(): () => Promise<{
  governor: Contract;
  mocCACoinbase: MocCACoinbase;
}> {
  return deployments.createFixture(async ({ ethers }) => {
    await deployments.fixture();
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

    const mocTC = await deployCollateralToken({
      adminAddress: deployMocProxy.address,
      governorAddress: governor.address,
    });

    let { pauserAddress, mocFeeFlowAddress, mocAppreciationBeneficiaryAddress } = mocAddresses;
    await waitForTxConfirmation(
      mocCACoinbase.initialize(
        {
          initializeBaseBucketParams: {
            tcTokenAddress: mocTC.address,
            mocFeeFlowAddress: mocFeeFlowAddress,
            mocAppreciationBeneficiaryAddress: mocAppreciationBeneficiaryAddress,
            protThrld: coreParams.protThrld,
            liqThrld: coreParams.liqThrld,
            feeRetainer: feeParams.feeRetainer,
            tcMintFee: feeParams.mintFee,
            tcRedeemFee: feeParams.redeemFee,
            swapTPforTPFee: feeParams.swapTPforTPFee,
            swapTPforTCFee: feeParams.swapTPforTCFee,
            swapTCforTPFee: feeParams.swapTCforTPFee,
            redeemTCandTPFee: feeParams.redeemTCandTPFee,
            mintTCandTPFee: feeParams.mintTCandTPFee,
            successFee: coreParams.successFee,
            appreciationFactor: coreParams.appreciationFactor,
          },
          governorAddress: governor.address,
          pauserAddress: pauserAddress,
          emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
          bes: settlementParams.bes,
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
