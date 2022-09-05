import { fixtureDeployedMocCABag } from "./fixture";
import { MocCARC20, MocCARC20__factory, MocCAWrapper, MocCAWrapper__factory, MocRC20 } from "../../typechain";
import { expect } from "chai";
import { ERRORS, CONSTANTS } from "../helpers/utils";
import { coreParams, tcParams, mocAddresses } from "../../deploy-config/config";
import { ethers } from "hardhat";
import { BigNumberish } from "ethers";
import { Address } from "hardhat-deploy/types";

describe("Feature: MocCABag initialization", function () {
  let mocProxy: MocCARC20;
  let mocWrapper: MocCAWrapper;
  let wcaToken: MocRC20;
  let mocCollateralToken: MocRC20;
  const { governor, stopper, mocFeeFlowAddress } = mocAddresses["hardhat"];
  const mocInitialize =
    (mocCARC20: MocCARC20) =>
    ({
      governorAddress = governor,
      stopperAddress = stopper,
      wcaTokenAddress = wcaToken.address,
      mocTCAddress = mocCollateralToken.address,
      feeFlowAddress = mocFeeFlowAddress,
      ctarg = coreParams.ctarg,
      protThrld = coreParams.protThrld,
      tcMintFee = tcParams.mintFee,
      tcRedeemFee = tcParams.redeemFee,
    }: {
      governorAddress?: Address;
      stopperAddress?: Address;
      wcaTokenAddress?: Address;
      mocTCAddress?: Address;
      feeFlowAddress?: Address;
      ctarg?: BigNumberish;
      protThrld?: BigNumberish;
      tcMintFee?: BigNumberish;
      tcRedeemFee?: BigNumberish;
    } = {}) => {
      return mocCARC20.initialize(
        governorAddress,
        stopperAddress,
        wcaTokenAddress,
        mocTCAddress,
        feeFlowAddress,
        ctarg,
        protThrld,
        tcMintFee,
        tcRedeemFee,
      );
    };
  describe("GIVEN a MocCABag implementation deployed", () => {
    before(async () => {
      ({ mocImpl: mocProxy, mocWrapper, mocCollateralToken, wcaToken } = await fixtureDeployedMocCABag(0)());
    });
    describe("WHEN initialize mocProxy again", async () => {
      it("THEN tx fails because contract is already initialized", async () => {
        await expect(mocInitialize(mocProxy)()).to.be.revertedWith(ERRORS.CONTRACT_INITIALIZED);
      });
    });
    describe("WHEN initialize mocWrapper again", async () => {
      it("THEN tx fails because contract is already initialized", async () => {
        await expect(mocWrapper.initialize(governor, stopper, mocProxy.address, wcaToken.address)).to.be.revertedWith(
          ERRORS.CONTRACT_INITIALIZED,
        );
      });
    });
  });

  describe("GIVEN a new MocCABag instance", () => {
    let newMocImpl: MocCARC20;
    before(async () => {
      const mocCARC20Factory = await ethers.getContractFactory("MocCARC20");
      const mocCARC20Impl = await mocCARC20Factory.deploy();

      const mocCARC20ProxyFactory = await ethers.getContractFactory("ERC1967Proxy");
      const proxy = await mocCARC20ProxyFactory.deploy(mocCARC20Impl.address, "0x");
      newMocImpl = MocCARC20__factory.connect(proxy.address, ethers.provider.getSigner());
    });
    describe("WHEN it is initialized with invalid governor address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(
          mocInitialize(newMocImpl)({ governorAddress: CONSTANTS.ZERO_ADDRESS }),
        ).to.be.revertedWithCustomError(newMocImpl, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN it is initialized with invalid stopper address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(
          mocInitialize(newMocImpl)({ stopperAddress: CONSTANTS.ZERO_ADDRESS }),
        ).to.be.revertedWithCustomError(newMocImpl, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN it is initialized with invalid Collateral Asset address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(
          mocInitialize(newMocImpl)({ wcaTokenAddress: CONSTANTS.ZERO_ADDRESS }),
        ).to.be.revertedWithCustomError(newMocImpl, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN it is initialized with invalid Collateral Token address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(mocInitialize(newMocImpl)({ mocTCAddress: CONSTANTS.ZERO_ADDRESS })).to.be.revertedWithCustomError(
          newMocImpl,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("WHEN it is initialized with invalid Moc Fee Flow address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(
          mocInitialize(newMocImpl)({ feeFlowAddress: CONSTANTS.ZERO_ADDRESS }),
        ).to.be.revertedWithCustomError(newMocImpl, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN it is initialized with invalid ctarg value", () => {
      it("THEN tx fails because ctarg is below ONE", async () => {
        await expect(mocInitialize(newMocImpl)({ ctarg: CONSTANTS.ONE.sub(1) })).to.be.revertedWithCustomError(
          newMocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid protThrld value", () => {
      it("THEN tx fails because protThrld is below ONE", async () => {
        await expect(mocInitialize(newMocImpl)({ protThrld: CONSTANTS.ONE.sub(1) })).to.be.revertedWithCustomError(
          newMocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid TCmintFee value", () => {
      it("THEN tx fails because TCmintFee is above ONE", async () => {
        await expect(mocInitialize(newMocImpl)({ tcMintFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          newMocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN it is initialized with invalid TCredeemFee value", () => {
      it("THEN tx fails because TCredeemFee is above ONE", async () => {
        await expect(mocInitialize(newMocImpl)({ tcRedeemFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          newMocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
  });

  describe("GIVEN a new MocCABag instance", () => {
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
          newMocWrapper.initialize(governor, stopper, CONSTANTS.ZERO_ADDRESS, wcaToken.address),
        ).to.be.revertedWithCustomError(newMocWrapper, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN it is initialized with invalid Wrapped Collateral Asset address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(
          newMocWrapper.initialize(governor, stopper, mocProxy.address, CONSTANTS.ZERO_ADDRESS),
        ).to.be.revertedWithCustomError(newMocWrapper, ERRORS.INVALID_ADDRESS);
      });
    });
  });
});
