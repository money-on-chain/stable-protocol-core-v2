import { fixtureDeployedMocCABag } from "./fixture";
import { MocCARC20, MocRC20, PriceProviderMock } from "../../typechain";
import { expect } from "chai";
import { ERRORS, deployPriceProvider, pEth } from "../helpers/utils";
import { tpParamsDefault } from "../helpers/utils";
import { BigNumberish, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";

describe("Feature: MocCABag edit Pegged Token", function () {
  let mocImpl: MocCARC20;
  let mocPeggedTokens: MocRC20[];
  let priceProviders: PriceProviderMock[];
  const mocEditPeggedToken =
    (mocCARC20: MocCARC20) =>
    ({
      tpTokenAddress = mocPeggedTokens[0].address,
      priceProviderAddress = priceProviders[0].address,
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
      return mocCARC20.editPeggedToken({
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

  describe("GIVEN a MocCABag implementation with two PeggedToken", () => {
    beforeEach(async () => {
      ({ mocImpl, mocPeggedTokens, priceProviders } = await fixtureDeployedMocCABag(2)());
    });
    describe("WHEN a Pegged Token price provided edited using a deprecated provider", () => {
      let deprecatedPriceProvider: PriceProviderMock;
      beforeEach(async () => {
        deprecatedPriceProvider = await deployPriceProvider(pEth(1));
        await deprecatedPriceProvider.deprecatePriceProvider();
      });
      it("THEN tx fails because address is invalid", async () => {
        await expect(
          mocEditPeggedToken(mocImpl)({ priceProviderAddress: deprecatedPriceProvider.address }),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN edit Pegged Token is invoked with an invalid pegged address", () => {
      it("THEN tx fails because address is is not indexed", async () => {
        await expect(
          mocEditPeggedToken(mocImpl)({ tpTokenAddress: priceProviders[0].address }),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN a Pegged Token is edited with valid parameters", () => {
      let tx: ContractTransaction;
      let editParams: any;
      beforeEach(async () => {
        editParams = {
          tpTokenAddress: mocPeggedTokens[0].address,
          priceProviderAddress: priceProviders[1].address,
          tpCtarg: tpParamsDefault.ctarg.add(1),
          tpR: tpParamsDefault.r + 2,
          tpBmin: tpParamsDefault.bmin + 3,
          tpMintFee: tpParamsDefault.mintFee.add(4),
          tpRedeemFee: tpParamsDefault.redeemFee.add(5),
          tpEma: tpParamsDefault.initialEma.add(6), // -----> Note: Emma cannot be edited, intentionally added
          tpEmaSf: tpParamsDefault.smoothingFactor.add(7),
          tpTils: tpParamsDefault.tils.add(8),
          tpTiMin: tpParamsDefault.tiMin.add(9),
          tpTiMax: tpParamsDefault.tiMax.add(10),
          tpAbeq: tpParamsDefault.abeq.add(11),
          tpFacMin: tpParamsDefault.facMin.add(12),
          tpFacMax: tpParamsDefault.facMax.add(13),
        };
        tx = await mocEditPeggedToken(mocImpl)(editParams);
      });
      it("THEN a PeggedTokenAdded event is emitted", async () => {
        await expect(tx).to.emit(mocImpl, "PeggedTokenAdded").withArgs(0, [
          mocPeggedTokens[0].address,
          priceProviders[1].address,
          editParams.tpCtarg,
          editParams.tpR,
          editParams.tpBmin,
          editParams.tpMintFee,
          editParams.tpRedeemFee,
          editParams.tpEma, // Note: ema should not be edited, although the event has the value it vas passed on
          editParams.tpEmaSf,
          editParams.tpTils,
          editParams.tpTiMin,
          editParams.tpTiMax,
          editParams.tpAbeq,
          editParams.tpFacMin,
          editParams.tpFacMax,
        ]);
      });
      it("THEN ema value itself has not change, only SF", async () => {
        const tpEma = await mocImpl.tpEma(0);
        expect(tpEma.ema).to.be.equal(tpParamsDefault.initialEma);
        expect(tpEma.sf).to.be.equal(editParams.tpEmaSf);
      });
      it("THEN new Pegged token ctar has changed", async () => {
        const tpCtarg = await mocImpl.tpCtarg(0);
        expect(tpCtarg).to.be.equal(editParams.tpCtarg);
      });
      it("THEN other Pegged token params have not changed", async () => {
        const tpCtarg = await mocImpl.tpCtarg(1);
        const tpEma = await mocImpl.tpEma(1);
        expect(tpCtarg).to.be.equal(tpParamsDefault.ctarg);
        expect(tpEma.sf).to.be.equal(tpParamsDefault.smoothingFactor);
      });
    });
  });
});
