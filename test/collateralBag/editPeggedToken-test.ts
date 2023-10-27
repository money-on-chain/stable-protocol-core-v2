import { expect } from "chai";
import { BigNumberish, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";
import { ERRORS, deployPriceProvider, pEth, tpParamsDefault } from "../helpers/utils";
import { MocCARC20, MocRC20, PriceProviderMock } from "../../typechain";
import { fixtureDeployedMocCABag } from "./fixture";

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
      tpMintFee = tpParamsDefault.mintFee,
      tpRedeemFee = tpParamsDefault.redeemFee,
      tpEma = tpParamsDefault.initialEma,
      tpEmaSf = tpParamsDefault.smoothingFactor,
      maxAbsoluteOpProviderAddress = priceProviders[0].address, // TODO: dummy address
      maxOpDiffProviderAddress = priceProviders[0].address, // TODO: dummy address
      decayBlockSpan = tpParamsDefault.decayBlockSpan,
    }: {
      tpTokenAddress?: Address;
      priceProviderAddress?: Address;
      tpCtarg?: BigNumberish;
      tpMintFee?: BigNumberish;
      tpRedeemFee?: BigNumberish;
      tpEma?: BigNumberish;
      tpEmaSf?: BigNumberish;
      maxAbsoluteOpProviderAddress?: Address;
      maxOpDiffProviderAddress?: Address;
      decayBlockSpan?: BigNumberish;
    } = {}) => {
      return mocCARC20.editPeggedToken({
        tpTokenAddress,
        priceProviderAddress,
        tpCtarg,
        tpMintFee,
        tpRedeemFee,
        tpEma,
        tpEmaSf,
        maxAbsoluteOpProviderAddress,
        maxOpDiffProviderAddress,
        decayBlockSpan,
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
          tpMintFee: tpParamsDefault.mintFee.add(4),
          tpRedeemFee: tpParamsDefault.redeemFee.add(5),
          tpEma: tpParamsDefault.initialEma.add(6), // -----> Note: Emma cannot be edited, intentionally added
          tpEmaSf: tpParamsDefault.smoothingFactor.add(7),
          maxAbsoluteOpProviderAddress: priceProviders[1].address, // TODO: dummy address
          maxOpDiffProviderAddress: priceProviders[1].address, // TODO: dummy address
          decayBlockSpan: tpParamsDefault.decayBlockSpan + 8,
        };
        tx = await mocEditPeggedToken(mocImpl)(editParams);
      });
      it("THEN a PeggedTokenChange event is emitted", async () => {
        await expect(tx).to.emit(mocImpl, "PeggedTokenChange").withArgs(0, [
          mocPeggedTokens[0].address,
          priceProviders[1].address,
          editParams.tpCtarg,
          editParams.tpMintFee,
          editParams.tpRedeemFee,
          editParams.tpEma, // Note: ema should not be edited, although the event has the value it vas passed on
          editParams.tpEmaSf,
          priceProviders[1].address, // TODO: dummy address
          priceProviders[1].address, // TODO: dummy address
          editParams.decayBlockSpan,
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
