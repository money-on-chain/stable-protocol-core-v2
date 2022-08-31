import { fixtureDeployedMocCABag } from "./fixture";
import { MocCARC20, MocCAWrapper, MocRC20 } from "../../typechain";
import { expect } from "chai";
import { ERRORS, CONSTANTS } from "../helpers/utils";
import { coreParams, tcParams, mocAddresses } from "../../deploy-config/config";
import { ethers } from "hardhat";

describe("Feature: MocCABag initialization", function () {
  let mocImpl: MocCARC20;
  let mocWrapper: MocCAWrapper;
  let wcaToken: MocRC20;
  let mocCollateralToken: MocRC20;
  const mocFeeFlow = mocAddresses["hardhat"].mocFeeFlowAddress;

  describe("GIVEN a MocCABag implementation deployed", () => {
    before(async () => {
      const fixtureDeploy = fixtureDeployedMocCABag(0);
      ({ mocImpl, mocWrapper, mocCollateralToken, wcaToken } = await fixtureDeploy());
    });
    describe("WHEN initialize mocImpl again", async () => {
      it("THEN tx fails because contract is already initialized", async () => {
        await expect(
          mocImpl.initialize(
            wcaToken.address,
            mocCollateralToken.address,
            mocFeeFlow,
            coreParams.ctarg,
            coreParams.protThrld,
            tcParams.mintFee,
            tcParams.redeemFee,
          ),
        ).to.be.revertedWith(ERRORS.CONTRACT_INITIALIZED);
      });
    });
    describe("WHEN initialize mocWrapper again", async () => {
      it("THEN tx fails because contract is already initialized", async () => {
        await expect(mocWrapper.initialize(mocImpl.address, wcaToken.address)).to.be.revertedWith(
          ERRORS.CONTRACT_INITIALIZED,
        );
      });
    });
  });

  describe("GIVEN a new MocCABag instance", () => {
    let newmocImpl: MocCARC20;
    before(async () => {
      const factory = await ethers.getContractFactory("MocCARC20");
      newmocImpl = await factory.deploy();
    });
    describe("WHEN it is initialized with invalid Collateral Asset address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(
          newmocImpl.initialize(
            CONSTANTS.ZERO_ADDRESS,
            mocCollateralToken.address,
            mocFeeFlow,
            coreParams.ctarg,
            coreParams.protThrld,
            tcParams.mintFee,
            tcParams.redeemFee,
          ),
        ).to.be.revertedWithCustomError(newmocImpl, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN it is initialized with invalid Collateral Token address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(
          newmocImpl.initialize(
            wcaToken.address,
            CONSTANTS.ZERO_ADDRESS,
            mocFeeFlow,
            coreParams.ctarg,
            coreParams.protThrld,
            tcParams.mintFee,
            tcParams.redeemFee,
          ),
        ).to.be.revertedWithCustomError(newmocImpl, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN it is initialized with invalid Moc Fee Flow address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(
          newmocImpl.initialize(
            wcaToken.address,
            mocCollateralToken.address,
            CONSTANTS.ZERO_ADDRESS,
            coreParams.ctarg,
            coreParams.protThrld,
            tcParams.mintFee,
            tcParams.redeemFee,
          ),
        ).to.be.revertedWithCustomError(newmocImpl, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN it is initialized with invalid ctarg value", () => {
      it("THEN tx fails because ctarg is below ONE", async () => {
        await expect(
          newmocImpl.initialize(
            wcaToken.address,
            mocCollateralToken.address,
            mocFeeFlow,
            CONSTANTS.ONE.sub(1),
            coreParams.protThrld,
            tcParams.mintFee,
            tcParams.redeemFee,
          ),
        ).to.be.revertedWithCustomError(newmocImpl, ERRORS.INVALID_VALUE);
      });
    });
    describe("WHEN it is initialized with invalid protThrld value", () => {
      it("THEN tx fails because protThrld is below ONE", async () => {
        await expect(
          newmocImpl.initialize(
            wcaToken.address,
            mocCollateralToken.address,
            mocFeeFlow,
            coreParams.ctarg,
            CONSTANTS.ONE.sub(1),
            tcParams.mintFee,
            tcParams.redeemFee,
          ),
        ).to.be.revertedWithCustomError(newmocImpl, ERRORS.INVALID_VALUE);
      });
    });
    describe("WHEN it is initialized with invalid TCmintFee value", () => {
      it("THEN tx fails because TCmintFee is above ONE", async () => {
        await expect(
          newmocImpl.initialize(
            wcaToken.address,
            mocCollateralToken.address,
            mocFeeFlow,
            coreParams.ctarg,
            coreParams.protThrld,
            CONSTANTS.ONE.add(1),
            tcParams.redeemFee,
          ),
        ).to.be.revertedWithCustomError(newmocImpl, ERRORS.INVALID_VALUE);
      });
    });
    describe("WHEN it is initialized with invalid TCredeemFee value", () => {
      it("THEN tx fails because TCredeemFee is above ONE", async () => {
        await expect(
          newmocImpl.initialize(
            wcaToken.address,
            mocCollateralToken.address,
            mocFeeFlow,
            coreParams.ctarg,
            coreParams.protThrld,
            tcParams.mintFee,
            CONSTANTS.ONE.add(1),
          ),
        ).to.be.revertedWithCustomError(newmocImpl, ERRORS.INVALID_VALUE);
      });
    });
  });

  describe("GIVEN a new MocCABag instance", () => {
    let newMocWrapper: MocCAWrapper;
    before(async () => {
      const factory = await ethers.getContractFactory("MocCAWrapper");
      newMocWrapper = await factory.deploy();
    });
    describe("WHEN it is initialized with invalid Moc Core address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(newMocWrapper.initialize(CONSTANTS.ZERO_ADDRESS, wcaToken.address)).to.be.revertedWithCustomError(
          newMocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("WHEN it is initialized with invalid Wrapped Collateral Asset address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(newMocWrapper.initialize(mocImpl.address, CONSTANTS.ZERO_ADDRESS)).to.be.revertedWithCustomError(
          newMocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
  });
});
