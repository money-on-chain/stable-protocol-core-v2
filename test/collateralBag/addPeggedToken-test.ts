import { fixtureDeployedMocCABag } from "./fixture";
import { MocCARC20, MocRC20, PriceProviderMock } from "../../typechain";
import { expect } from "chai";
import { ERRORS, CONSTANTS, deployPeggedToken, deployPriceProvider, pEth } from "../helpers/utils";
import { tpParams } from "../../deploy-config/config";
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
      tpR = tpParams.r,
      tpBmin = tpParams.bmin,
      tpMintFee = tpParams.mintFee,
      tpRedeemFee = tpParams.redeemFee,
      tpEma = tpParams.initialEma,
      tpEmaSf = tpParams.smoothingFactor,
      tpTils = tpParams.tils,
      tpTiMin = tpParams.tiMin,
      tpTiMax = tpParams.tiMax,
      tpAbeq = tpParams.abeq,
      tpFacMin = tpParams.facMin,
      tpFacMax = tpParams.facMax,
    }: {
      tpTokenAddress?: Address;
      priceProviderAddress?: Address;
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
      return mocCARC20.addPeggedToken(
        tpTokenAddress,
        priceProviderAddress,
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
      );
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
    describe("WHEN a Pegged Token is added with valid parameters", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        tx = await mocAddPeggedToken(mocImpl)();
      });
      it("THEN a PeggedTokenAdded event is emmited", async () => {
        await expect(tx)
          .to.emit(mocImpl, "PeggedTokenAdded")
          .withArgs(
            0,
            mocPeggedToken.address,
            priceProvider.address,
            tpParams.r,
            tpParams.bmin,
            tpParams.mintFee,
            tpParams.redeemFee,
            tpParams.initialEma,
            tpParams.smoothingFactor,
            tpParams.tils,
            tpParams.tiMin,
            tpParams.tiMax,
            tpParams.abeq,
            tpParams.facMin,
            tpParams.facMax,
          );
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
