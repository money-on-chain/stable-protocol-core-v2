import { fixtureDeployedMocCoinbase } from "./../coinbase/fixture";
import { MocCACoinbase, MocRC20, PriceProviderMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { getNamedAccounts } from "hardhat";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { mineNBlocks, pEth } from "../helpers/utils";
import { coreParams } from "../../deploy-config/config";

describe("Feature: Ema Calculation", function () {
  let mocImpl: MocCACoinbase;
  let mocCollateralToken: MocRC20;
  let mocPeggedTokens: MocRC20[];
  let priceProviders: PriceProviderMock[];
  let alice: Address;
  let bob: Address;
  const peggedAmount = 2;

  beforeEach(async function () {
    ({ alice, bob } = await getNamedAccounts());
    const fixtureDeploy = fixtureDeployedMocCoinbase(peggedAmount);
    ({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders } = await fixtureDeploy());
    this.mocFunctions = await mocFunctionsCoinbase({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders });
  });
  describe("GIVEN a MocCoinbase implementation deployed with two Pegged Tokens", function () {
    describe("WHEN pegged price changes, but update ema is evaluated before time", function () {
      it("THEN there is no change, since emaCalculationBlockSpan has not yet passed", async function () {
        const prevValue = (await mocImpl.tpEma(0)).ema;
        await priceProviders[0].poke(pEth(2));
        expect(await mocImpl.shouldCalculateEma()).to.be.false;
        await mocImpl.updateEmas();
        const posValue = (await mocImpl.tpEma(0)).ema;
        expect(prevValue).to.be.equal(posValue);
      });
    });
    describe("AND pegged prices has changed, AND emaCalculationBlockSpan blocks has passed", function () {
      describe("WHEN updateEma is invoked", function () {
        it("THEN new Ema values are assigned", async function () {
          await mineNBlocks(coreParams.emaCalculationBlockSpan);
          expect(await mocImpl.shouldCalculateEma()).to.be.true;
          const prevValues = await Promise.all(priceProviders.map((_, i) => mocImpl.tpEma(i)));
          await Promise.all(priceProviders.map(pp => pp.poke(pEth(2))));
          const tx = await mocImpl.updateEmas();
          for (let i = 0; i < peggedAmount; i++) {
            const posValue = await mocImpl.tpEma(i);
            expect(prevValues[i].ema).not.to.be.equal(posValue.ema);
            await expect(tx).to.emit(mocImpl, "TPemaUpdated").withArgs(i, prevValues[i].ema, posValue.ema);
          }
          expect(await mocImpl.shouldCalculateEma()).to.be.false;
        });
      });
      describe("WHEN mintTP is invoked", function () {
        it("THEN new Ema values are assigned as it's triggered by the operation", async function () {
          await mineNBlocks(coreParams.emaCalculationBlockSpan);
          expect(await mocImpl.shouldCalculateEma()).to.be.true;
          const prevValues = await Promise.all(priceProviders.map((_, i) => mocImpl.tpEma(i)));
          await Promise.all(priceProviders.map(pp => pp.poke(pEth(2))));
          await this.mocFunctions.mintTC({ from: alice, qTC: 10, qACmax: 15 });
          const tx = await this.mocFunctions.mintTP({ i: 0, from: bob, qTP: 1 });
          for (let i = 0; i < peggedAmount; i++) {
            const posValue = await mocImpl.tpEma(i);
            expect(prevValues[i].ema).not.to.be.equal(posValue.ema);
            await expect(tx).to.emit(mocImpl, "TPemaUpdated").withArgs(i, prevValues[i].ema, posValue.ema);
          }
        });
      });
    });
  });
});
