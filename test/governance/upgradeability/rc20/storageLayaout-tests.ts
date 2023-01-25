import hre, { ethers, getNamedAccounts, upgrades } from "hardhat";
import { Contract } from "ethers";
import { MocCARC20__factory } from "../../../../typechain";
import { GAS_LIMIT_PATCH, deployCollateralToken } from "../../../helpers/utils";
import { getNetworkDeployParams } from "../../../../scripts/utils";

const { coreParams, feeParams, settlementParams } = getNetworkDeployParams(hre);

describe("Feature: Check MocCARC20 storage layout compatibility using openzeppelin hardhat upgrade ", () => {
  let mocProxy: Contract;
  describe("GIVEN a MocCARC20 Proxy is deployed", () => {
    beforeEach(async () => {
      const { deployer } = await getNamedAccounts();

      const governorMockFactory = await ethers.getContractFactory("GovernorMock");
      const governorMock = await governorMockFactory.deploy();

      const mocProxyFactory = await ethers.getContractFactory("MocCARC20");
      const mocCoreExpansion = await (await ethers.getContractFactory("MocCoreExpansion")).deploy();

      mocProxy = await upgrades.deployProxy(mocProxyFactory, undefined, {
        // FIXME: this is needed because of this issue: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/455
        unsafeAllow: ["delegatecall"],
        kind: "uups",
        initializer: false,
      });

      const mocTC = await deployCollateralToken({
        adminAddress: mocProxy.address,
        governorAddress: governorMock.address,
      });

      const initParams = {
        initializeCoreParams: {
          initializeBaseBucketParams: {
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
            successFee: coreParams.successFee,
            appreciationFactor: coreParams.appreciationFactor,
            bes: settlementParams.bes,
          },
          governorAddress: governorMock.address,
          pauserAddress: deployer,
          mocCoreExpansion: mocCoreExpansion.address,
          emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
        },
        acTokenAddress: deployer,
      };
      const mocImpl = MocCARC20__factory.connect(mocProxy.address, ethers.provider.getSigner());
      await mocImpl.initialize(initParams, { gasLimit: GAS_LIMIT_PATCH });
    });
    describe("WHEN it is upgraded to a new implementation", () => {
      it("THEN it succeeds as it is consistent with the previous storage", async () => {
        const mocRC20MockFactory = await ethers.getContractFactory("MocCARC20Mock");
        await upgrades.upgradeProxy(mocProxy.address, mocRC20MockFactory, {
          // FIXME: this is needed because of this issue: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/455
          unsafeAllow: ["delegatecall"],
        });
      });
    });
    describe("WHEN check storage layout compatibility between MocCore and MocCoreExpansion", () => {
      // this test will fail if new storage variables are declare in MocCore.sol or MocCoreExtension.sol
      it("THEN it succeeds as there is not storage collision", async () => {
        const mocRC20Factory = await ethers.getContractFactory("MocCARC20");
        const mocCoreExpansionFactory = await ethers.getContractFactory("MocCoreExpansion");
        await upgrades.validateUpgrade(mocCoreExpansionFactory, mocRC20Factory, {
          // FIXME: this is needed because of this issue: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/455
          unsafeAllow: ["delegatecall"],
        });
      });
    });
  });
});
