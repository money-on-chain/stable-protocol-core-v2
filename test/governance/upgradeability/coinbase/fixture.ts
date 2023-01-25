import hre, { deployments, getNamedAccounts } from "hardhat";
import { Contract } from "ethers";
import memoizee from "memoizee";

import { MocCACoinbase, MocCACoinbase__factory } from "../../../../typechain";
import { getNetworkDeployParams, waitForTxConfirmation } from "../../../../scripts/utils";
import { deployAeropagusGovernor, deployCollateralToken } from "../../../helpers/utils";

const { coreParams, feeParams, settlementParams, mocAddresses } = getNetworkDeployParams(hre);

export const fixtureDeployGovernance = memoizee(
  (): (() => Promise<{
    governor: Contract;
    mocCACoinbase: MocCACoinbase;
  }>) => {
    return deployments.createFixture(async ({ ethers }) => {
      await deployments.fixture();
      const { deployer } = await getNamedAccounts();

      // deploy and initialize governor
      const [mocCoreFactory, mocCoreExpansionFactory, erc1967ProxyProxyFactory] = await Promise.all([
        ethers.getContractFactory("MocCACoinbase"),
        ethers.getContractFactory("MocCoreExpansion"),
        ethers.getContractFactory("ERC1967Proxy"),
      ]);
      const mocImpl = await mocCoreFactory.deploy();
      const mocCoreExpansion = await mocCoreExpansionFactory.deploy();
      const deployMocProxy = await erc1967ProxyProxyFactory.deploy(mocImpl.address, "0x");
      const mocCACoinbase = MocCACoinbase__factory.connect(deployMocProxy.address, ethers.provider.getSigner());

      const governor = await deployAeropagusGovernor(deployer);

      const mocTC = await deployCollateralToken({
        adminAddress: deployMocProxy.address,
        governorAddress: governor.address,
      });

      await waitForTxConfirmation(
        mocCACoinbase.initialize({
          initializeBaseBucketParams: {
            feeTokenAddress: mocAddresses.feeTokenAddress,
            feeTokenPriceProviderAddress: mocAddresses.feeTokenPriceProviderAddress,
            tcTokenAddress: mocTC.address,
            mocFeeFlowAddress: mocAddresses.mocFeeFlowAddress,
            mocAppreciationBeneficiaryAddress: mocAddresses.mocAppreciationBeneficiaryAddress,
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
            feeTokenPct: feeParams.feeTokenPct,
            successFee: coreParams.successFee,
            appreciationFactor: coreParams.appreciationFactor,
            bes: settlementParams.bes,
          },
          governorAddress: governor.address,
          pauserAddress: mocAddresses.pauserAddress,
          mocCoreExpansion: mocCoreExpansion.address,
          emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
        }),
      );

      return {
        governor,
        mocCACoinbase,
      };
    });
  },
);
