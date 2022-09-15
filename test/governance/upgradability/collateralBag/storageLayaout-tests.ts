import { ethers, getNamedAccounts, upgrades } from "hardhat";
import { Contract } from "ethers";

import { coreParams, tcParams } from "../../../../deploy-config/config";

describe("Feature: Check MocRC20 storage layout compatibility using openzeppelin hardhat upgrade ", () => {
  let mocProxy: Contract;
  describe("GIVEN an Moc Proxy is deployed", () => {
    before(async () => {
      const { deployer } = await getNamedAccounts();

      const governorMockFactory = await ethers.getContractFactory("GovernorMock");
      const governorMock = await governorMockFactory.deploy();

      const mocProxyFactory = await ethers.getContractFactory("MocCARC20");
      const initParams = [
        {
          governorAddress: governorMock.address,
          stopperAddress: deployer,
          acTokenAddress: deployer,
          tcTokenAddress: deployer,
          mocSettlementAddress: deployer,
          mocFeeFlowAddress: deployer,
          mocInterestCollectorAddress: deployer,
          ctarg: coreParams.ctarg,
          protThrld: coreParams.protThrld,
          liqThrld: coreParams.liqThrld,
          tcMintFee: tcParams.mintFee,
          tcRedeemFee: tcParams.redeemFee,
          emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
        },
      ];
      mocProxy = await upgrades.deployProxy(mocProxyFactory, initParams, {
        // FIXME: this is needed because of this issue: https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/455
        unsafeAllow: ["delegatecall"],
        kind: "uups",
      });
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
