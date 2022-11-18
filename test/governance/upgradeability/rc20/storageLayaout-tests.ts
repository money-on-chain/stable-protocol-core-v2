import { ethers, getNamedAccounts, upgrades } from "hardhat";
import { Contract } from "ethers";
import { MocCARC20__factory } from "../../../../typechain";
import { GAS_LIMIT_PATCH, deployCollateralToken } from "../../../helpers/utils";
import { getNetworkConfig } from "../../../../scripts/utils";

const { coreParams, feeParams } = getNetworkConfig({ network: "hardhat" });

describe("Feature: Check MocCARC20 storage layout compatibility using openzeppelin hardhat upgrade ", () => {
  let mocProxy: Contract;
  describe("GIVEN a MocCARC20 Proxy is deployed", () => {
    before(async () => {
      const { deployer } = await getNamedAccounts();

      const governorMockFactory = await ethers.getContractFactory("GovernorMock");
      const governorMock = await governorMockFactory.deploy();

      const mocProxyFactory = await ethers.getContractFactory("MocCARC20");

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
            mocSettlementAddress: deployer,
            mocFeeFlowAddress: deployer,
            mocInterestCollectorAddress: deployer,
            mocAppreciationBeneficiaryAddress: deployer,
            protThrld: coreParams.protThrld,
            liqThrld: coreParams.liqThrld,
            feeRetainer: feeParams.feeRetainer,
            tcMintFee: feeParams.mintFee,
            tcRedeemFee: feeParams.redeemFee,
            swapTPforTPFee: feeParams.swapTPforTPFee,
            swapTPforTCFee: feeParams.swapTPforTCFee,
            redeemTCandTPFee: feeParams.redeemTCandTPFee,
            mintTCandTPFee: feeParams.mintTCandTPFee,
            successFee: coreParams.successFee,
            appreciationFactor: coreParams.appreciationFactor,
          },
          governorAddress: governorMock.address,
          pauserAddress: deployer,
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
  });
});
