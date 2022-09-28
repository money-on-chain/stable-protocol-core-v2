import { fixtureDeployedMocCoinbase } from "./../coinbase/fixture";
import { MocCACoinbase, MocRC20, PriceProviderMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { getNamedAccounts } from "hardhat";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { mineNBlocks, pEth } from "../helpers/utils";
import { coreParams } from "../../deploy-config/config";
import { BigNumber, ContractTransaction } from "ethers";
import { assertPrec } from "../helpers/assertHelper";

describe("Feature: Ema Calculation", function () {
  let mocFunctions: any;
  let mocImpl: MocCACoinbase;
  let mocCollateralToken: MocRC20;
  let mocPeggedTokens: MocRC20[];
  let priceProviders: PriceProviderMock[];
  let deployer: Address;
  let alice: Address;
  let bob: Address;
  const peggedAmount = 4;
  const tpParams = [
    {
      price: pEth(235),
      ctarg: pEth(5),
      initialEma: pEth(212.04),
      smoothingFactor: pEth(0.05),
    },
    {
      price: pEth(5.25),
      ctarg: pEth(4),
      initialEma: pEth(5.04),
      smoothingFactor: pEth(0.05),
    },
    {
      price: pEth(934.58),
      ctarg: pEth(3.5),
      initialEma: pEth(837.33),
      smoothingFactor: pEth(0.01),
    },
    {
      price: pEth(20.1),
      ctarg: pEth(3),
      initialEma: pEth(20.23),
      smoothingFactor: pEth(0.01),
    },
  ];

  beforeEach(async function () {
    ({ deployer, alice, bob } = await getNamedAccounts());
    const fixtureDeploy = fixtureDeployedMocCoinbase(peggedAmount, tpParams);
    ({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders } = await fixtureDeploy());
    mocFunctions = await mocFunctionsCoinbase({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders });
    this.mocFunctions = mocFunctions;
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
    describe("WHEN pegged prices has changed, AND emaCalculationBlockSpan blocks has passed", () => {
      let prevValues: { ema: any }[];
      let assertUpdatedEmas: (tx: ContractTransaction) => void;
      beforeEach(async function () {
        await mineNBlocks(coreParams.emaCalculationBlockSpan);
        prevValues = await Promise.all(priceProviders.map((_, i) => mocImpl.tpEma(i)));
        await Promise.all(priceProviders.map(pp => pp.poke(pEth(2))));
        assertUpdatedEmas = async tx => {
          for (let i = 0; i < peggedAmount; i++) {
            const posValue = await mocImpl.tpEma(i);
            expect(prevValues[i].ema).not.to.be.equal(posValue.ema);
            await expect(tx).to.emit(mocImpl, "TPemaUpdated").withArgs(i, prevValues[i].ema, posValue.ema);
          }
          expect(await mocImpl.shouldCalculateEma()).to.be.false;
        };
      });
      it("THEN shouldCalculateEma returns true", async function () {
        expect(await mocImpl.shouldCalculateEma()).to.be.true;
      });
      describe("WHEN updateEma is invoked", function () {
        it("THEN new Ema values are assigned", async function () {
          const tx = await mocImpl.updateEmas();
          await assertUpdatedEmas(tx);
        });
      });
      describe("WHEN mintTP is invoked", function () {
        it("THEN new Ema values are assigned as it's triggered by the operation", async function () {
          await this.mocFunctions.mintTC({ from: alice, qTC: 10, qACmax: 15 });
          const tx = await this.mocFunctions.mintTP({ i: 0, from: bob, qTP: 1 });
          await assertUpdatedEmas(tx);
        });
      });
    });
    describe("AND there are open positions", () => {
      beforeEach(async () => {
        await mocFunctions.mintTC({ from: deployer, qTC: 10000000000000 });
        await Promise.all(
          [50000000, 500000, 100000000, 1000000].map((qTP, i) => mocFunctions.mintTP({ i, from: alice, qTP })),
        );
      });
      describe("WHEN get ctargemaCA", async () => {
        let ctargemaCA: BigNumber;
        beforeEach(async () => {
          ctargemaCA = await mocImpl.callStatic.calcCtargemaCA();
        });
        it("THEN ctargemaCA is equal to 4.61", async () => {
          /*
            ctargemaTP0: 5.54
            ctargemaTP1: 4.17
            ctargemaTP2: 3.91
            ctargemaTP3: 3
          */
          assertPrec(ctargemaCA, "4.611238561357574541");
        });
      });
      describe("AND pegged prices have changed", () => {
        beforeEach(async () => {
          await Promise.all([250, 5.33, 925.93, 20.26].map((price, i) => priceProviders[i].poke(pEth(price))));
          await mineNBlocks(coreParams.emaCalculationBlockSpan);
        });
        describe("WHEN get ctargemaCA", async () => {
          let ctargemaCA: BigNumber;
          beforeEach(async () => {
            ctargemaCA = await mocImpl.callStatic.calcCtargemaCA();
          });
          it("THEN ctargemaCA is equal to 4.72", async () => {
            /*
              ctargemaTP0: 5.85
              ctargemaTP1: 4.22
              ctargemaTP2: 3.87
              ctargemaTP3: 3
            */
            assertPrec(ctargemaCA, "4.721307466577826196");
          });
        });
      });
    });
  });
});
