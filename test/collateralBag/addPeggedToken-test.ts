import { fixtureDeployedMocCABag } from "./fixture";
import { MocCARC20, MocRC20, PriceProviderMock } from "../../typechain";
import { expect } from "chai";
import { ERRORS, CONSTANTS, deployPeggedToken, deployPriceProvider, pEth } from "../helpers/utils";
import { tpParamsDefault } from "../helpers/utils";
import { BigNumberish, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";

describe("Feature: MocCABag add Pegged Token", function () {
  let mocImpl: MocCARC20;
  let mocPeggedToken: MocRC20;
  let priceProvider: PriceProviderMock;
  const mocAddPeggedToken =
    (mocCARC20: MocCARC20) =>
    ({
      tpTokenAddress = mocPeggedToken.address,
      priceProviderAddress = priceProvider.address,
      tpCtarg = tpParamsDefault.ctarg,
      tpR = tpParamsDefault.r,
      tpBmin = tpParamsDefault.bmin,
      tpMintFee = tpParamsDefault.mintFee,
      tpRedeemFee = tpParamsDefault.redeemFee,
      tpEma = tpParamsDefault.initialEma,
      tpEmaSf = tpParamsDefault.smoothingFactor,
      tpTils = tpParamsDefault.tils,
      tpTiMin = tpParamsDefault.tiMin,
      tpTiMax = tpParamsDefault.tiMax,
      tpAbeq = tpParamsDefault.abeq,
      tpFacMin = tpParamsDefault.facMin,
      tpFacMax = tpParamsDefault.facMax,
    }: {
      tpTokenAddress?: Address;
      priceProviderAddress?: Address;
      tpCtarg?: BigNumberish;
      tpR?: BigNumberish;
      tpBmin?: BigNumberish;
      tpMintFee?: BigNumberish;
      tpRedeemFee?: BigNumberish;
      tpEma?: BigNumberish;
      tpEmaSf?: BigNumberish;
      tpTils?: BigNumberish;
      tpTiMin?: BigNumberish;
      tpTiMax?: BigNumberish;
      tpAbeq?: BigNumberish;
      tpFacMin?: BigNumberish;
      tpFacMax?: BigNumberish;
    } = {}) => {
      return mocCARC20.addPeggedToken({
        tpTokenAddress,
        priceProviderAddress,
        tpCtarg,
        tpR,
        tpBmin,
        tpMintFee,
        tpRedeemFee,
        tpEma,
        tpEmaSf,
        tpTils,
        tpTiMin,
        tpTiMax,
        tpAbeq,
        tpFacMin,
        tpFacMax,
      });
    };

  describe("GIVEN a MocCABag implementation deployed", () => {
    before(async () => {
      ({ mocImpl } = await fixtureDeployedMocCABag(0)());
      mocPeggedToken = await deployPeggedToken();
      priceProvider = await deployPriceProvider(pEth(1));
    });
    describe("WHEN a Pegged Token is added with invalid token address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(
          mocAddPeggedToken(mocImpl)({ tpTokenAddress: CONSTANTS.ZERO_ADDRESS }),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN a Pegged Token is added with invalid price provider address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(
          mocAddPeggedToken(mocImpl)({ priceProviderAddress: CONSTANTS.ZERO_ADDRESS }),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN a Pegged Token is added with invalid target coverage value", () => {
      it("THEN tx fails because target coverage is below ONE", async () => {
        await expect(mocAddPeggedToken(mocImpl)({ tpCtarg: CONSTANTS.ONE.sub(1) })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN a Pegged Token is added with invalid mint fee value", () => {
      it("THEN tx fails because mint fee is above ONE", async () => {
        await expect(mocAddPeggedToken(mocImpl)({ tpMintFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN a Pegged Token is added with invalid redeem fee value", () => {
      it("THEN tx fails because redeem fee is above ONE", async () => {
        await expect(mocAddPeggedToken(mocImpl)({ tpRedeemFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN a Pegged Token is added with invalid ema smoothing factor value", () => {
      it("THEN tx fails because ema smoothing factor is above ONE", async () => {
        await expect(mocAddPeggedToken(mocImpl)({ tpEmaSf: CONSTANTS.ONE })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN a Pegged Token is added with invalid initial interest rate value", () => {
      it("THEN tx fails because interest rate is above ONE", async () => {
        await expect(mocAddPeggedToken(mocImpl)({ tpTils: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN a Pegged Token is added with invalid minimum interest rate value", () => {
      it("THEN tx fails because minimum interest rate is above ONE", async () => {
        await expect(mocAddPeggedToken(mocImpl)({ tpTiMin: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN a Pegged Token is added with invalid maximum interest rate value", () => {
      it("THEN tx fails because maximum interest rate is above ONE", async () => {
        await expect(mocAddPeggedToken(mocImpl)({ tpTiMax: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN a Pegged Token is added with invalid abundance value", () => {
      it("THEN tx fails because abundance is above ONE", async () => {
        await expect(mocAddPeggedToken(mocImpl)({ tpAbeq: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN a Pegged Token is added with invalid minimum correction factor for interest rate value", () => {
      it("THEN tx fails because minimum correction factor for interest rate is above ONE", async () => {
        await expect(mocAddPeggedToken(mocImpl)({ tpFacMin: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN a Pegged Token is added with invalid minimum correction factor for interest rate value", () => {
      it("THEN tx fails because minimum correction factor for interest rate is below ONE", async () => {
        await expect(mocAddPeggedToken(mocImpl)({ tpFacMax: CONSTANTS.ONE.sub(1) })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.INVALID_VALUE,
        );
      });
    });
    describe("WHEN a Pegged Token is added with valid parameters", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        tx = await mocAddPeggedToken(mocImpl)();
      });
      it("THEN a PeggedTokenAdded event is emmited", async () => {
        await expect(tx)
          .to.emit(mocImpl, "PeggedTokenAdded")
          .withArgs(0, [
            mocPeggedToken.address,
            priceProvider.address,
            tpParamsDefault.ctarg,
            tpParamsDefault.r,
            tpParamsDefault.bmin,
            tpParamsDefault.mintFee,
            tpParamsDefault.redeemFee,
            tpParamsDefault.initialEma,
            tpParamsDefault.smoothingFactor,
            tpParamsDefault.tils,
            tpParamsDefault.tiMin,
            tpParamsDefault.tiMax,
            tpParamsDefault.abeq,
            tpParamsDefault.facMin,
            tpParamsDefault.facMax,
          ]);
      });
      describe("AND try to add it again", () => {
        it("THEN tx fails because Pegged Token is already added", async () => {
          await expect(mocAddPeggedToken(mocImpl)()).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.PEGGED_TOKEN_ALREADY_ADDED,
          );
        });
      });
    });
  });
});
