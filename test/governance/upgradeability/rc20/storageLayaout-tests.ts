import { ethers, getNamedAccounts, upgrades } from "hardhat";
import { Contract } from "ethers";

import { coreParams, tcParams } from "../../../../deploy-config/config";
import { MocCARC20__factory } from "../../../../typechain";
import { deployCollateralToken, GAS_LIMIT_PATCH } from "../../../helpers/utils";

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
        governorAddress: governorMock.address,
        stopperAddress: deployer,
        acTokenAddress: deployer,
        tcTokenAddress: mocTC.address,
        mocSettlementAddress: deployer,
        mocFeeFlowAddress: deployer,
        mocInterestCollectorAddress: deployer,
        protThrld: coreParams.protThrld,
        liqThrld: coreParams.liqThrld,
        tcMintFee: tcParams.mintFee,
        tcRedeemFee: tcParams.redeemFee,
        emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
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
