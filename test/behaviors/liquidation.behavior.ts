import { MocCACoinbase, MocCARC20, MocRC20, PriceProviderMock } from "../../typechain";
import { ethers, getNamedAccounts } from "hardhat";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { ERRORS, pEth } from "../helpers/utils";
import { ContractTransaction } from "ethers";

const shouldBehaveLikeLiquidable = function () {
  let mocImpl: MocCACoinbase | MocCARC20;
  let mocCollateralToken: MocRC20;
  let priceProviders: PriceProviderMock[];
  let alice: Address, bob: Address, charlie: Address;

  describe("GIVEN there are open positions by multiple users", function () {
    beforeEach(async function () {
      ({ alice, bob, charlie } = await getNamedAccounts());
      await this.mocFunctions.mintTC({ from: alice, qTC: 100 });
      await this.mocFunctions.mintTP({ i: 0, from: bob, qTP: 20 });
      await this.mocFunctions.mintTP({ i: 1, from: charlie, qTP: 10 });
      ({ mocImpl, mocCollateralToken, priceProviders } = this.mocContracts);
    });
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
            ERRORS.LIQUIDATED,
          );
        });
        it("THEN even if prices are restored, alice cannot redeemTC", async function () {
          // errorless revert assert here because, depending on implementation, redeem might fail
          // before actually executing redeemTC but on moving TC assets and hitting paused revert
          await expect(this.mocFunctions.redeemTC({ from: alice, qTC: 1 })).to.be.reverted;
        });
        it("THEN even if prices are restored, bob cannot mintTP", async function () {
          await expect(this.mocFunctions.mintTP({ i: 0, from: bob, qTP: 1 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.LIQUIDATED,
          );
        });
        it("THEN even if prices are restored, bob cannot redeemTP", async function () {
          // TODO: complete when ready
        });
      });
    });
  });
};

export { shouldBehaveLikeLiquidable };
