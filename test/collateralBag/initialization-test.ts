import { fixtureDeployedMocCABag } from "./fixture";
import {
  MocCARC20,
  MocCARC20__factory,
  MocCAWrapper,
  MocCAWrapper__factory,
  MocRC20,
  MocSettlement,
} from "../../typechain";
import { expect } from "chai";
import { ERRORS, CONSTANTS } from "../helpers/utils";
import { mocInitialize } from "./initializers";
import { mocAddresses } from "../../deploy-config/config";
import { ethers, deployments } from "hardhat";

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

      const mocTCFactory = await ethers.getContractFactory("MocTC");
      const newMocTC = await mocTCFactory.deploy("mocCT", "CT", proxy.address);

      const newMocImpl = MocCARC20__factory.connect(proxy.address, ethers.provider.getSigner());
      newMocInit = mocInitialize(newMocImpl, wcaToken.address, newMocTC.address, mocSettlement.address);
    });
    describe("WHEN it is initialized with invalid governor address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(newMocInit({ mocGovernorAddress: CONSTANTS.ZERO_ADDRESS })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("WHEN it is initialized with invalid pauser address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(newMocInit({ mocPauserAddress: CONSTANTS.ZERO_ADDRESS })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("WHEN it is initialized with invalid Collateral Asset address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(newMocInit({ wcaTokenAddress: CONSTANTS.ZERO_ADDRESS })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("WHEN it is initialized with invalid Collateral Token address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        // revert without reason string trying to ask roles to address zero
        await expect(newMocInit({ mocTCAddress: CONSTANTS.ZERO_ADDRESS })).to.be.reverted;
      });
    });
    describe("WHEN it is initialized with invalid Moc Settlement address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(newMocInit({ mocSettlementAddress: CONSTANTS.ZERO_ADDRESS })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("WHEN it is initialized with invalid Moc Fee Flow address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(newMocInit({ feeFlowAddress: CONSTANTS.ZERO_ADDRESS })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("WHEN it is initialized with invalid Moc interest collector address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(newMocInit({ interestCollectorAddress: CONSTANTS.ZERO_ADDRESS })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("WHEN it is initialized with invalid Moc Turbo address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(newMocInit({ turboAddress: CONSTANTS.ZERO_ADDRESS })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("WHEN it is initialized with invalid protThrld value", () => {
      it("THEN tx fails because protThrld is below ONE", async () => {
        await expect(newMocInit({ protThrld: CONSTANTS.ONE.sub(1) })).to.be.revertedWithCustomError(
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
    describe("WHEN it is initialized with invalid success fee value", () => {
      it("THEN tx fails because sf is above ONE", async () => {
        await expect(newMocInit({ sf: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocProxy,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid appreciation factor value", () => {
      it("THEN tx fails because fa is above ONE", async () => {
        await expect(newMocInit({ fa: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
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

  describe("GIVEN a new MocWrapper instance", () => {
    let newMocWrapper: MocCAWrapper;
    before(async () => {
      const MocCAWrapperFactory = await ethers.getContractFactory("MocCAWrapper");
      const MocCAWrapperImpl = await MocCAWrapperFactory.deploy();

      const mocCARC20ProxyFactory = await ethers.getContractFactory("ERC1967Proxy");
      const proxy = await mocCARC20ProxyFactory.deploy(MocCAWrapperImpl.address, "0x");
      newMocWrapper = MocCAWrapper__factory.connect(proxy.address, ethers.provider.getSigner());
    });
    describe("WHEN it is initialized with invalid Moc Core address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(
          newMocWrapper.initialize(governorAddress, pauserAddress, CONSTANTS.ZERO_ADDRESS, wcaToken.address),
        ).to.be.revertedWithCustomError(newMocWrapper, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN it is initialized with invalid Wrapped Collateral Asset address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(
          newMocWrapper.initialize(governorAddress, pauserAddress, mocProxy.address, CONSTANTS.ZERO_ADDRESS),
        ).to.be.revertedWithCustomError(newMocWrapper, ERRORS.INVALID_ADDRESS);
      });
    });
  });
});
