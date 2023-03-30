import hre, { ethers, getNamedAccounts, upgrades } from "hardhat";
import { Contract } from "ethers";
import { MocCACoinbase__factory } from "../../../../typechain";
import { GAS_LIMIT_PATCH, deployCollateralToken } from "../../../helpers/utils";
import { getNetworkDeployParams } from "../../../../scripts/utils";

const { coreParams, feeParams, settlementParams } = getNetworkDeployParams(hre);

describe("Feature: Check MocCoinbase storage layout compatibility using openzeppelin hardhat upgrade ", () => {
  let mocProxy: Contract;
  describe("GIVEN a Moc Proxy is deployed", () => {
    beforeEach(async () => {
      const { deployer } = await getNamedAccounts();

      const governorMockFactory = await ethers.getContractFactory("GovernorMock");
      const governorMock = await governorMockFactory.deploy();

      const mocProxyFactory = await ethers.getContractFactory("MocCACoinbase");
      const mocCoreExpansion = await (await ethers.getContractFactory("MocCoreExpansion")).deploy();

      mocProxy = await upgrades.deployProxy(mocProxyFactory, undefined, {
        // we allow delegatecall to use MocCoreExpansion
        unsafeAllow: ["delegatecall"],
        kind: "uups",
        initializer: false,
      });

      const mocTC = await deployCollateralToken({
        adminAddress: mocProxy.address,
        governorAddress: governorMock.address,
      });

      const initParams = {
        initializeBaseBucketParams: {
          feeTokenAddress: deployer,
          feeTokenPriceProviderAddress: deployer,
          tcTokenAddress: mocTC.address,
          mocFeeFlowAddress: deployer,
          mocAppreciationBeneficiaryAddress: deployer,
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
          bes: settlementParams.bes,
          appreciationFactor: coreParams.appreciationFactor,
          tcInterestCollectorAddress: deployer,
          tcInterestRate: coreParams.tcInterestRate,
          tcInterestPaymentBlockSpan: coreParams.tcInterestPaymentBlockSpan,
        },
        governorAddress: governorMock.address,
        pauserAddress: deployer,
        mocCoreExpansion: mocCoreExpansion.address,
        emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
        mocVendors: deployer, // Not relevant for this test
      };
      const mocImpl = MocCACoinbase__factory.connect(mocProxy.address, ethers.provider.getSigner());
      await mocImpl.initialize(initParams, { gasLimit: GAS_LIMIT_PATCH });
    });
    describe("WHEN it is upgraded to a new implementation", () => {
      it("THEN it succeeds as it is consistent with the previous storage", async () => {
        const mocCoinbaseMockFactory = await ethers.getContractFactory("MocCoinbaseMock");
        await upgrades.upgradeProxy(mocProxy.address, mocCoinbaseMockFactory, {
          // we allow delegatecall to use MocCoreExpansion
          unsafeAllow: ["delegatecall"],
        });
      });
    });
    describe("WHEN check storage layout compatibility between MocCore and MocCoreExpansion", () => {
      // this test will fail if new storage variables are declare in MocCore.sol or MocCoreExtension.sol
      it("THEN it succeeds as there is not storage collision", async () => {
        const mocCoinbaseFactory = await ethers.getContractFactory("MocCACoinbase");
        const mocCoreExpansionFactory = await ethers.getContractFactory("MocCoreExpansion");
        await upgrades.validateUpgrade(mocCoreExpansionFactory, mocCoinbaseFactory, {
          // we allow delegatecall to use MocCoreExpansion
          unsafeAllow: ["delegatecall"],
        });
      });
    });
  });
});
