import { expect } from "chai";
import { BigNumberish, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";
import { ERRORS, deployPeggedToken, deployPriceProvider, pEth, tpParamsDefault } from "../helpers/utils";
import { MocCARC20, MocRC20, PriceProviderMock } from "../../typechain";
import { fixtureDeployedMocRC20 } from "../rc20/fixture";

describe("Feature: MocCARC20 add Pegged Token", function () {
  let mocImpl: MocCARC20;
  let mocPeggedToken: MocRC20;
  let priceProvider: PriceProviderMock;
  const mocAddPeggedToken =
    (mocCARC20: MocCARC20) =>
    ({
      tpTokenAddress = mocPeggedToken.address,
      priceProviderAddress = priceProvider.address,
      tpCtarg = tpParamsDefault.ctarg,
      tpMintFee = tpParamsDefault.mintFee,
      tpRedeemFee = tpParamsDefault.redeemFee,
      tpEma = tpParamsDefault.initialEma,
      tpEmaSf = tpParamsDefault.smoothingFactor,
    }: {
      tpTokenAddress?: Address;
      priceProviderAddress?: Address;
      tpCtarg?: BigNumberish;
      tpMintFee?: BigNumberish;
      tpRedeemFee?: BigNumberish;
      tpEma?: BigNumberish;
      tpEmaSf?: BigNumberish;
    } = {}) => {
      return mocCARC20.addPeggedToken({
        tpTokenAddress,
        priceProviderAddress,
        tpCtarg,
        tpMintFee,
        tpRedeemFee,
        tpEma,
        tpEmaSf,
      });
    };

  describe("GIVEN a MocCARC20 implementation deployed", () => {
    beforeEach(async () => {
      ({ mocImpl } = await fixtureDeployedMocRC20(0)());
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
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.MISSING_PROVIDER_PRICE);
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
            tpParamsDefault.mintFee,
            tpParamsDefault.redeemFee,
            tpParamsDefault.initialEma,
            tpParamsDefault.smoothingFactor,
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
