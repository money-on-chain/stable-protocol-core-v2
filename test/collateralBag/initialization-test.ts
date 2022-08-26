import { fixtureDeployedMocCARBag } from "./fixture";
import { MocCARC20, MocCAWrapper, MocRC20 } from "../../typechain";
import { expect } from "chai";
import { ERRORS, CONSTANTS } from "../helpers/utils";
import { coreParams, tcParams, mocAddresses } from "../../deploy-config/config";
import { ethers } from "hardhat";

describe("Feature: MocCARBag initialization", function () {
  let mocCore: MocCARC20;
  let mocWrapper: MocCAWrapper;
  let wcaToken: MocRC20;
  let mocCollateralToken: MocRC20;
  const mocFeeFlow = mocAddresses["hardhat"].mocFeeFlowAddress;

  describe("GIVEN a MocCARBag implementation deployed", () => {
    beforeEach(async () => {
      const fixtureDeploy = fixtureDeployedMocCARBag(0);
      ({ mocCore, mocWrapper, mocCollateralToken, wcaToken } = await fixtureDeploy());
    });
    describe("WHEN initialize mocCore again", async () => {
      it("THEN tx fail because contract is already initialized", async () => {
        await expect(
          mocCore.initialize(
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
      it("THEN tx fail because contract is already initialized", async () => {
        await expect(mocWrapper.initialize(mocCore.address, wcaToken.address)).to.be.revertedWith(
          ERRORS.CONTRACT_INITIALIZED,
        );
      });
    });
  });

  describe("GIVEN a new MocCARBag instance", () => {
    let newMocCore: MocCARC20;
    beforeEach(async () => {
      const factory = await ethers.getContractFactory("MocCARC20");
      newMocCore = await factory.deploy();
    });
    describe("WHEN it is initialized with invalid Collateral Asset address", () => {
      it("THEN tx fail because address is the zero address", async () => {
        await expect(
          newMocCore.initialize(
            CONSTANTS.ZERO_ADDRESS,
            mocCollateralToken.address,
            mocFeeFlow,
            coreParams.ctarg,
            coreParams.protThrld,
            tcParams.mintFee,
            tcParams.redeemFee,
          ),
        ).to.be.revertedWithCustomError(newMocCore, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN it is initialized with invalid Collateral Token address", () => {
      it("THEN tx fail because address is the zero address", async () => {
        await expect(
          newMocCore.initialize(
            wcaToken.address,
            CONSTANTS.ZERO_ADDRESS,
            mocFeeFlow,
            coreParams.ctarg,
            coreParams.protThrld,
            tcParams.mintFee,
            tcParams.redeemFee,
          ),
        ).to.be.revertedWithCustomError(newMocCore, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN it is initialized with invalid Moc Fee Flow address", () => {
      it("THEN tx fail because address is the zero address", async () => {
        await expect(
          newMocCore.initialize(
            wcaToken.address,
            mocCollateralToken.address,
            CONSTANTS.ZERO_ADDRESS,
            coreParams.ctarg,
            coreParams.protThrld,
            tcParams.mintFee,
            tcParams.redeemFee,
          ),
        ).to.be.revertedWithCustomError(newMocCore, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN it is initialized with invalid ctarg value", () => {
      it("THEN tx fail because ctarg is below ONE", async () => {
        await expect(
          newMocCore.initialize(
            wcaToken.address,
            mocCollateralToken.address,
            mocFeeFlow,
            CONSTANTS.ONE.sub(1),
            coreParams.protThrld,
            tcParams.mintFee,
            tcParams.redeemFee,
          ),
        ).to.be.revertedWithCustomError(newMocCore, ERRORS.INVALID_VALUE);
      });
    });
    describe("WHEN it is initialized with invalid protThrld value", () => {
      it("THEN tx fail because protThrld is below ONE", async () => {
        await expect(
          newMocCore.initialize(
            wcaToken.address,
            mocCollateralToken.address,
            mocFeeFlow,
            coreParams.ctarg,
            CONSTANTS.ONE.sub(1),
            tcParams.mintFee,
            tcParams.redeemFee,
          ),
        ).to.be.revertedWithCustomError(newMocCore, ERRORS.INVALID_VALUE);
      });
    });
    describe("WHEN it is initialized with invalid TCmintFee value", () => {
      it("THEN tx fail because TCmintFee is above ONE", async () => {
        await expect(
          newMocCore.initialize(
            wcaToken.address,
            mocCollateralToken.address,
            mocFeeFlow,
            coreParams.ctarg,
            coreParams.protThrld,
            CONSTANTS.ONE.add(1),
            tcParams.redeemFee,
          ),
        ).to.be.revertedWithCustomError(newMocCore, ERRORS.INVALID_VALUE);
      });
    });
    describe("WHEN it is initialized with invalid TCredeemFee value", () => {
      it("THEN tx fail because TCredeemFee is above ONE", async () => {
        await expect(
          newMocCore.initialize(
            wcaToken.address,
            mocCollateralToken.address,
            mocFeeFlow,
            coreParams.ctarg,
            coreParams.protThrld,
            tcParams.mintFee,
            CONSTANTS.ONE.add(1),
          ),
        ).to.be.revertedWithCustomError(newMocCore, ERRORS.INVALID_VALUE);
      });
    });
  });

  describe("GIVEN a new MocCARBag instance", () => {
    let newMocWrapper: MocCAWrapper;
    beforeEach(async () => {
      const factory = await ethers.getContractFactory("MocCAWrapper");
      newMocWrapper = await factory.deploy();
    });
    describe("WHEN it is initialized with invalid Moc Core address", () => {
      it("THEN tx fail because address is the zero address", async () => {
        await expect(newMocWrapper.initialize(CONSTANTS.ZERO_ADDRESS, wcaToken.address)).to.be.revertedWithCustomError(
          newMocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("WHEN it is initialized with invalid Wrapped Collateral Asset address", () => {
      it("THEN tx fail because address is the zero address", async () => {
        await expect(newMocWrapper.initialize(mocCore.address, CONSTANTS.ZERO_ADDRESS)).to.be.revertedWithCustomError(
          newMocWrapper,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
  });
});
