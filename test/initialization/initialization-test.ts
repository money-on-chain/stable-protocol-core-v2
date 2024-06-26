import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import {
  MocCARC20,
  MocCoreExpansion,
  MocCARC20__factory,
  MocRC20,
  MocVendors,
  ERC20Mock,
  MocQueue,
} from "../../typechain";
import { fixtureDeployedMocCoinbase } from "../coinbase/fixture";
import { CONSTANTS, ERRORS, deployAndInitTC, getNetworkDeployParams } from "../helpers/utils";
import { fixtureDeployedMocRC20 } from "../rc20/fixture";
import { mocInitialize } from "./initializers";

describe("Feature: Moc initializations", function () {
  let mocProxy: MocCARC20;
  let collateralAsset: ERC20Mock;
  let mocCollateralToken: MocRC20;
  let mocPeggedTokens: MocRC20[];
  let mocInit: any;
  let mocCoreExpansion: MocCoreExpansion;
  let mocVendors: MocVendors;
  let mocQueue: MocQueue;
  const { queueParams, mocAddresses } = getNetworkDeployParams(hre);
  before(async () => {
    ({
      mocImpl: mocProxy,
      mocCoreExpansion,
      mocCollateralToken,
      collateralAsset,
      mocVendors,
      mocQueue,
      mocPeggedTokens,
    } = await fixtureDeployedMocRC20(1)());
    mocInit = mocInitialize(
      mocProxy,
      mocCollateralToken.address,
      mocCoreExpansion.address,
      mocVendors.address,
      mocQueue.address,
      { acTokenAddress: collateralAsset.address },
    );
  });
  describe("GIVEN a MocCARC20 implementation deployed", () => {
    describe("WHEN initialize mocProxy again", async () => {
      it("THEN tx fails because contract is already initialized", async () => {
        await expect(mocInit()).to.be.revertedWith(ERRORS.CONTRACT_INITIALIZED);
      });
    });
    describe("WHEN initialize the moc implementation", async () => {
      let mocImplementation: MocCARC20;
      it("THEN tx fails because contract is already initialized", async () => {
        mocImplementation = MocCARC20__factory.connect(
          (await deployments.get("MocCARC20Proxy")).implementation!,
          ethers.provider.getSigner(),
        );
        await expect(
          mocInitialize(
            mocImplementation,
            mocCollateralToken.address,
            mocCoreExpansion.address,
            mocVendors.address,
            mocQueue.address,
            { acTokenAddress: collateralAsset.address },
          )(),
        ).to.be.revertedWith(ERRORS.CONTRACT_INITIALIZED);
      });
    });
    describe("WHEN initialize mocVendorsProxy again", async () => {
      it("THEN tx fails because contract is already initialized", async () => {
        await expect(
          mocVendors.initialize(mocProxy.address, mocAddresses.governorAddress, mocAddresses.pauserAddress),
        ).to.be.revertedWith(ERRORS.CONTRACT_INITIALIZED);
      });
    });
    describe("WHEN initialize mocQueueProxy again", async () => {
      it("THEN tx fails because contract is already initialized", async () => {
        await expect(
          mocQueue.initialize(
            mocAddresses.governorAddress,
            mocAddresses.pauserAddress,
            queueParams.minOperWaitingBlk,
            queueParams.maxOperPerBatch,
            queueParams.execFeeParams,
          ),
        ).to.be.revertedWith(ERRORS.CONTRACT_INITIALIZED);
      });
    });
    describe("WHEN initialize mocTC again", async () => {
      it("THEN tx fails because contract is already initialized", async () => {
        await expect(
          mocCollateralToken.initialize("TC", "TC", mocAddresses.governorAddress, mocAddresses.governorAddress),
        ).to.be.revertedWith(ERRORS.CONTRACT_INITIALIZED);
      });
    });
    describe("WHEN initialize mocRC20 again", async () => {
      it("THEN tx fails because contract is already initialized", async () => {
        await expect(
          mocPeggedTokens[0].initialize("TP", "TP", mocAddresses.governorAddress, mocAddresses.governorAddress),
        ).to.be.revertedWith(ERRORS.CONTRACT_INITIALIZED);
      });
    });
  });

  describe("GIVEN a MocCACoinbase implementation deployed", () => {
    describe("WHEN initialize mocProxy again", async () => {
      it("THEN tx fails because contract is already initialized", async () => {
        const { mocImpl: mocProxy } = await fixtureDeployedMocCoinbase(0)();
        const mocInit = mocInitialize(
          mocProxy,
          mocCollateralToken.address,
          mocCoreExpansion.address,
          mocVendors.address,
          mocQueue.address,
          { transferMaxGas: 0, coinbaseFailedTransferFallback: mocVendors.address },
        );
        await expect(mocInit()).to.be.revertedWith(ERRORS.CONTRACT_INITIALIZED);
      });
    });
  });

  describe("GIVEN a new MocCARC20 instance", () => {
    let newMocInit: any;
    before(async () => {
      const mocCARC20Factory = await ethers.getContractFactory("MocCARC20");
      const mocCARC20Impl = await mocCARC20Factory.deploy();

      const mocCARC20ProxyFactory = await ethers.getContractFactory("ERC1967Proxy");
      const proxy = await mocCARC20ProxyFactory.deploy(mocCARC20Impl.address, "0x");

      const newMocImpl = MocCARC20__factory.connect(proxy.address, ethers.provider.getSigner());

      const newMocTC = await deployAndInitTC({
        adminAddress: proxy.address,
        governorAddress: await newMocImpl.governor(),
      });
      newMocInit = mocInitialize(
        newMocImpl,
        newMocTC.address,
        mocCoreExpansion.address,
        mocVendors.address,
        mocQueue.address,
        { acTokenAddress: collateralAsset.address },
      );
    });
    describe("WHEN it is initialized with invalid protThrld value", () => {
      it("THEN tx fails because protThrld is below ONE", async () => {
        await expect(newMocInit({ protThrld: CONSTANTS.ONE.sub(1) })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid feeRetainer value", () => {
      it("THEN tx fails because feeRetainer is above ONE", async () => {
        await expect(newMocInit({ feeRetainer: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid TCmintFee value", () => {
      it("THEN tx fails because TCmintFee is above ONE", async () => {
        await expect(newMocInit({ tcMintFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid TCredeemFee value", () => {
      it("THEN tx fails because TCredeemFee is above ONE", async () => {
        await expect(newMocInit({ tcRedeemFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid swapTPforTPFee value", () => {
      it("THEN tx fails because swapTPforTPFee is above ONE", async () => {
        await expect(newMocInit({ swapTPforTPFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid swapTPforTCFee value", () => {
      it("THEN tx fails because swapTPforTCFee is above ONE", async () => {
        await expect(newMocInit({ swapTPforTCFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid swapTCforTPFee value", () => {
      it("THEN tx fails because swapTCforTPFee is above ONE", async () => {
        await expect(newMocInit({ swapTCforTPFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid redeemTCandTPFee value", () => {
      it("THEN tx fails because redeemTCandTPFee is above ONE", async () => {
        await expect(newMocInit({ redeemTCandTPFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid mintTCandTPFee value", () => {
      it("THEN tx fails because mintTCandTPFee is above ONE", async () => {
        await expect(newMocInit({ mintTCandTPFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid success fee value", () => {
      it("THEN tx fails because sf is above ONE", async () => {
        await expect(newMocInit({ successFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid appreciation factor value", () => {
      it("THEN tx fails because fa is above ONE", async () => {
        await expect(newMocInit({ appreciationFactor: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid emaCalculationBlockSpan value", () => {
      it("THEN tx fails because emaCalculationBlockSpan cannot be zero", async () => {
        await expect(newMocInit({ emaCalculationBlockSpan: 0 })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_VALUE,
        );
      });
    });
  });
});
