import { fixtureDeployedMocCoinbase } from "./../coinbase/fixture";
import { MocCACoinbase, MocRC20, PriceProviderMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { ethers, getNamedAccounts } from "hardhat";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { ERRORS, pEth } from "../helpers/utils";
import { ContractTransaction } from "ethers";

describe("Feature: Moc Liquidation", function () {
  let mocImpl: MocCACoinbase;
  let mocCollateralToken: MocRC20;
  let mocPeggedTokens: MocRC20[];
  let priceProviders: PriceProviderMock[];
  let alice: Address, bob: Address, charlie: Address;
  const peggedAmount = 2;

  beforeEach(async function () {
    ({ alice, bob } = await getNamedAccounts());
    const fixtureDeploy = fixtureDeployedMocCoinbase(peggedAmount);
    ({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders } = await fixtureDeploy());
    this.mocFunctions = await mocFunctionsCoinbase({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders });
    await this.mocFunctions.mintTC({ from: alice, qTC: 100 });
    await this.mocFunctions.mintTP({ i: 0, from: bob, qTP: 20 });
    await this.mocFunctions.mintTP({ i: 1, from: charlie, qTP: 10 });
  });
  describe("GIVEN a MocCoinbase implementation, with two Pegged Tokens", function () {
    describe("WHEN peg prices falls, and makes the coverage go under liquidation threshold", function () {
      beforeEach(async function () {
        await priceProviders[0].poke(pEth(0.1));
        await priceProviders[1].poke(pEth(0.1));
      });
      it("THEN isLiquidationReached returns true", async function () {
        expect(await mocImpl.isLiquidationReached()).to.be.true;
      });
      describe("WHEN someone evaluates liquidation", function () {
        it("THEN it doesn't have any effect, as liquidation is disabled", async function () {
          expect(await mocImpl.liqEnabled()).to.be.false;
          await mocImpl.evalLiquidation();
          expect(await mocImpl.liquidated()).to.be.false;
        });
      });
      describe("WHEN liquidation is enabled, and then evaluated", function () {
        let tx: ContractTransaction;
        beforeEach(async function () {
          await mocImpl.setLiqEnabled(true);
          tx = await mocImpl.evalLiquidation();

          await priceProviders[0].poke(pEth(1));
          await priceProviders[1].poke(pEth(1));
        });
        it("THEN contract is liquidated", async function () {
          expect(await mocImpl.liquidated()).to.be.true;
        });
        it("THEN contract liquidated even is emitted", async function () {
          await expect(tx).to.emit(mocImpl, "ContractLiquidated");
        });
        it("THEN a Token Collateral transfer fails, as Token is paused", async function () {
          await expect(mocCollateralToken.connect(await ethers.getSigner(alice)).transfer(bob, 1)).to.be.revertedWith(
            "ERC20Pausable: token transfer while paused",
          );
        });
        it("THEN even if prices are restored, alice cannot mintTC", async function () {
          await expect(this.mocFunctions.mintTC({ from: alice, qTC: 1 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.NOT_LIQUIDATED,
          );
        });
        it("THEN even if prices are restored, alice cannot mintTC", async function () {
          await expect(this.mocFunctions.redeemTC({ from: alice, qTC: 1 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.NOT_LIQUIDATED,
          );
        });
        it("THEN even if prices are restored, bob cannot mintTP", async function () {
          await expect(this.mocFunctions.mintTP({ i: 0, from: bob, qTP: 1 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.NOT_LIQUIDATED,
          );
        });
      });
    });
  });
});
