import { expect } from "chai";
import { BigNumberish, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";
import { ERRORS, deployPeggedToken, deployPriceProvider, pEth, tpParamsDefault } from "../helpers/utils";
import { MocCARC20, MocRC20, PriceProviderMock } from "../../typechain";
import { fixtureDeployedMocCABag } from "./fixture";

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
    beforeEach(async () => {
      ({ mocImpl } = await fixtureDeployedMocCABag(0)());
      const governorAddress = await mocImpl.governor();
      mocPeggedToken = await deployPeggedToken({ adminAddress: mocImpl.address, governorAddress });
      priceProvider = await deployPriceProvider(pEth(1));
    });
    describe("WHEN a Pegged Token is added with a deprecated price provider", () => {
      let deprecatedPriceProvider: PriceProviderMock;
      beforeEach(async () => {
        deprecatedPriceProvider = await deployPriceProvider(pEth(1));
        await deprecatedPriceProvider.deprecatePriceProvider();
      });
      it("THEN tx fails because address is invalid", async () => {
        await expect(
          mocAddPeggedToken(mocImpl)({ priceProviderAddress: deprecatedPriceProvider.address }),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_PRICE_PROVIDER);
      });
    });
    describe("WHEN a Pegged Token is added with valid parameters", () => {
      let tx: ContractTransaction;
      beforeEach(async () => {
        tx = await mocAddPeggedToken(mocImpl)();
      });
      it("THEN a PeggedTokenChange event is emitted", async () => {
        await expect(tx)
          .to.emit(mocImpl, "PeggedTokenChange")
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
