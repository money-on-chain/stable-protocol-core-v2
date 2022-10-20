import { ethers, getNamedAccounts, upgrades } from "hardhat";
import { Contract } from "ethers";

import { coreParams, tcParams } from "../../../../deploy-config/config";
import { MocCACoinbase__factory } from "../../../../typechain";
import { GAS_LIMIT_PATCH } from "../../../helpers/utils";

describe("Feature: Check MocCoinbase storage layout compatibility using openzeppelin hardhat upgrade ", () => {
  let mocProxy: Contract;
  describe("GIVEN an Moc Proxy is deployed", () => {
    before(async () => {
      const { deployer } = await getNamedAccounts();

      const governorMockFactory = await ethers.getContractFactory("GovernorMock");
      const governorMock = await governorMockFactory.deploy();

      const mocProxyFactory = await ethers.getContractFactory("MocCACoinbase");

      mocProxy = await upgrades.deployProxy(mocProxyFactory, undefined, {
        kind: "uups",
        initializer: false,
      });

      const mocTCFactory = await ethers.getContractFactory("MocTC");
      const mocTC = await mocTCFactory.deploy("mocCT", "CT", mocProxy.address);

      const initParams = {
        initializeBaseBucketParams: {
          tcTokenAddress: mocTC.address,
          mocSettlementAddress: deployer,
          mocFeeFlowAddress: deployer,
          mocInterestCollectorAddress: deployer,
          mocTurboAddress: deployer,
          protThrld: coreParams.protThrld,
          liqThrld: coreParams.liqThrld,
          tcMintFee: tcParams.mintFee,
          tcRedeemFee: tcParams.redeemFee,
          fasf: coreParams.fasf,
          sf: coreParams.sf,
        },
        governorAddress: governorMock.address,
        pauserAddress: deployer,
        emaCalculationBlockSpan: coreParams.emaCalculationBlockSpan,
      };
      const mocImpl = MocCACoinbase__factory.connect(mocProxy.address, ethers.provider.getSigner());
      await mocImpl.initialize(initParams, { gasLimit: GAS_LIMIT_PATCH });
    });
    describe("WHEN it is upgraded to a new implementation", () => {
      it("THEN it succeeds as it is consistent with the previous storage", async () => {
        const mocCoinbaseMockFactory = await ethers.getContractFactory("MocCoinbaseMock");
        await upgrades.upgradeProxy(mocProxy.address, mocCoinbaseMockFactory);
      });
    });
  });
});
