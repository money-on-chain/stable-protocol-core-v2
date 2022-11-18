import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import {
  MocCARC20,
  MocCARC20__factory,
  MocCAWrapper,
  MocCAWrapper__factory,
  MocRC20,
  MocSettlement,
} from "../../typechain";
import { CONSTANTS, ERRORS, deployCollateralToken } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";
import { fixtureDeployedMocCABag } from "./fixture";
import { mocInitialize } from "./initializers";

describe("Feature: MocCABag initialization", function () {
  let mocProxy: MocCARC20;
  let mocWrapper: MocCAWrapper;
  let mocSettlement: MocSettlement;
  let wcaToken: MocRC20;
  let mocCollateralToken: MocRC20;
  let mocInit: any;
  const { governorAddress, pauserAddress } = mocAddresses["hardhat"];
  before(async () => {
    ({
      mocImpl: mocProxy,
      mocWrapper,
      mocCollateralToken,
      wcaToken,
      mocSettlement,
    } = await fixtureDeployedMocCABag(0)());
    mocInit = mocInitialize(mocProxy, wcaToken.address, mocCollateralToken.address, mocSettlement.address);
  });
  describe("GIVEN a MocCABag implementation deployed", () => {
    describe("WHEN initialize mocProxy again", async () => {
      it("THEN tx fails because contract is already initialized", async () => {
        await expect(mocInit()).to.be.revertedWith(ERRORS.CONTRACT_INITIALIZED);
      });
    });
    describe("WHEN initialize the moc implementation", async () => {
      let mocImplementation: MocCARC20;
      it("THEN tx fails because contract is already initialized", async () => {
        mocImplementation = MocCARC20__factory.connect(
          (await deployments.get("MocCABagImpl")).address,
          ethers.provider.getSigner(),
        );
        await expect(
          mocInitialize(mocImplementation, wcaToken.address, mocCollateralToken.address, mocSettlement.address)(),
        ).to.be.revertedWith(ERRORS.CONTRACT_INITIALIZED);
      });
    });
    describe("WHEN initialize mocWrapper again", async () => {
      it("THEN tx fails because contract is already initialized", async () => {
        await expect(
          mocWrapper.initialize(governorAddress, pauserAddress, mocProxy.address, wcaToken.address),
        ).to.be.revertedWith(ERRORS.CONTRACT_INITIALIZED);
      });
    });
    describe("WHEN initialize the mocWrapper implementation", async () => {
      let mocWrapperImplementation: MocCAWrapper;
      it("THEN tx fails because contract is already initialized", async () => {
        mocWrapperImplementation = MocCAWrapper__factory.connect(
          (await deployments.get("MocCAWrapperImpl")).address,
          ethers.provider.getSigner(),
        );
        await expect(
          mocWrapperImplementation.initialize(governorAddress, pauserAddress, mocProxy.address, wcaToken.address),
        ).to.be.revertedWith(ERRORS.CONTRACT_INITIALIZED);
      });
    });
  });

  describe("GIVEN a new MocCABag instance", () => {
    let newMocInit: any;
    before(async () => {
      const mocCARC20Factory = await ethers.getContractFactory("MocCARC20");
      const mocCARC20Impl = await mocCARC20Factory.deploy();

      const mocCARC20ProxyFactory = await ethers.getContractFactory("ERC1967Proxy");
      const proxy = await mocCARC20ProxyFactory.deploy(mocCARC20Impl.address, "0x");

      const newMocImpl = MocCARC20__factory.connect(proxy.address, ethers.provider.getSigner());

      const newMocTC = await deployCollateralToken({
        adminAddress: proxy.address,
        governorAddress: await newMocImpl.governor(),
      });
      newMocInit = mocInitialize(newMocImpl, wcaToken.address, newMocTC.address, mocSettlement.address);
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
