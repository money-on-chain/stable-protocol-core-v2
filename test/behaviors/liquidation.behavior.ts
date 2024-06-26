import { ethers, getNamedAccounts } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { Balance, ERRORS, ERROR_SELECTOR, pEth } from "../helpers/utils";
import { MocCACoinbase, MocCARC20, MocQueue, MocRC20, PriceProviderMock } from "../../typechain";
import { assertPrec } from "../helpers/assertHelper";

const shouldBehaveLikeLiquidable = function () {
  let mocImpl: MocCACoinbase | MocCARC20;
  let mocQueue: MocQueue;
  let mocCollateralToken: MocRC20;
  let priceProviders: PriceProviderMock[];
  let alice: Address, bob: Address, charlie: Address, otherUser: Address;
  let tp1: Address;

  describe("GIVEN there are open positions by multiple users", function () {
    beforeEach(async function () {
      ({ alice, bob, charlie, otherUser } = await getNamedAccounts());
      await this.mocFunctions.mintTC({ from: alice, qTC: 100 });
      await this.mocFunctions.mintTP({ i: 0, from: bob, qTP: 20 });
      await this.mocFunctions.mintTP({ i: 1, from: charlie, qTP: 10 });
      ({ mocImpl, mocCollateralToken, priceProviders, mocQueue } = this.mocContracts);
      tp1 = this.mocContracts.mocPeggedTokens[1].address;
    });
    describe("WHEN AC prices falls, and makes the coverage go under liquidation threshold", function () {
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
      describe("WHEN alice tries to liquidate his TP", function () {
        it("THEN tx fails because contract is not liquidated yet", async function () {
          await expect(this.mocFunctions.liqRedeemTP({ from: alice })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.ONLY_LIQUIDATED,
          );
        });
      });
      describe("WHEN someone injects collateral and re-evaluates", function () {
        it("THEN Liquidation is not longer Reached", async function () {
          await this.mocFunctions.acTransfer({
            from: alice,
            to: mocImpl.address,
            amount: 1000,
          });
          await mocImpl.evalLiquidation();
          expect(await mocImpl.liquidated()).to.be.false;
          expect(await mocImpl.isLiquidationReached()).to.be.false;
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
          await expect(this.mocFunctions.mintTP({ from: bob, qTP: 1 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.LIQUIDATED,
          );
        });
        it("THEN even if prices are restored, bob cannot redeemTP", async function () {
          await expect(this.mocFunctions.redeemTP({ from: bob, qTP: 1 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.LIQUIDATED,
          );
        });
        it("THEN even if prices are restored, bob cannot swapTPforTP", async function () {
          await expect(
            this.mocFunctions.swapTPforTP({ iFrom: 0, iTo: 1, from: bob, qTP: 1 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.LIQUIDATED);
        });
        it("THEN even if prices are restored, bob cannot swapTPforTC", async function () {
          await expect(this.mocFunctions.swapTPforTC({ from: bob, qTP: 1 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.LIQUIDATED,
          );
        });
        it("THEN even if prices are restored, bob cannot swapTCforTP", async function () {
          // errorless revert assert here because, depending on implementation, redeem might fail
          // before actually executing swapTCforTP but on moving TC assets and hitting paused revert
          await expect(this.mocFunctions.swapTCforTP({ from: bob, qTC: 1 })).to.be.reverted;
        });
        it("THEN even if prices are restored, bob cannot redeemTCandTP", async function () {
          // errorless revert assert here because, depending on implementation, redeem might fail
          // before actually executing redeemTC but on moving TC assets and hitting paused revert
          await expect(this.mocFunctions.redeemTCandTP({ from: bob, qTC: 1, qTP: 1 })).to.be.reverted;
        });
        it("THEN even if prices are restored, bob cannot mintTCandTP", async function () {
          await expect(this.mocFunctions.mintTCandTP({ from: bob, qTP: 1 })).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.LIQUIDATED,
          );
        });
        describe("WHEN Bob and Charlie redeem their TPs by liquidation redeem", async function () {
          let bobPrevAssetBalance: Balance, charliePrevAssetBalance: Balance, otherUserPrevAssetBalance: Balance;
          beforeEach(async function () {
            [bobPrevAssetBalance, charliePrevAssetBalance, otherUserPrevAssetBalance] = await Promise.all(
              [bob, charlie, otherUser].map(account => this.mocFunctions.assetBalanceOf(account)),
            );
            await this.mocFunctions.liqRedeemTP({ from: bob });
            tx = await this.mocFunctions.liqRedeemTP({ i: 1, from: charlie, to: otherUser });
          });
          it("THEN theirs TP are burned", async function () {
            assertPrec(0, await this.mocFunctions.tpBalanceOf(0, bob));
            assertPrec(0, await this.mocFunctions.tpBalanceOf(1, charlie));
          });
          it("THEN a liq redeem event is generated for Charlie", async function () {
            // i: 1
            // sender: charlie
            // receiver: otherUser
            // qTP: 10 TP
            // qAC: 0.43333... AC
            const qAC = "43333333333333333247";
            await expect(tx).to.emit(mocImpl, "LiqTPRedeemed").withArgs(tp1, charlie, otherUser, pEth(10), qAC);
          });
          it("THEN they receive the corresponding AC amount", async function () {
            // Alice, bob and Charlie contribution at 1:1
            const totalAC = 100 + 20 + 10;
            const lckAC = 20 + 10;
            const bobACShare = pEth(20 * totalAC).div(lckAC);
            const charlieACShare = pEth(10 * totalAC).div(lckAC);
            const [bobActualAssetBalance, charlieActualAssetBalance, otherUserActualAssetBalance] = await Promise.all(
              [bob, charlie, otherUser].map(account => this.mocFunctions.assetBalanceOf(account)),
            );
            const bobDiff = bobActualAssetBalance.sub(bobPrevAssetBalance);
            const charlieDiff = charlieActualAssetBalance.sub(charliePrevAssetBalance);
            const otherUserDiff = otherUserActualAssetBalance.sub(otherUserPrevAssetBalance);
            // 1/14th of a reference value as tolerance
            const tolerance = bobACShare.div(10e14).toNumber();
            assertPrec(bobACShare, bobDiff, "Bob's Asset balance", tolerance);
            assertPrec(0, charlieDiff, "Charlies's Asset balance", tolerance);
            assertPrec(charlieACShare, otherUserDiff, "Charlies's Asset balance", tolerance);
          });
          it("THEN contract balance is zero", async function () {
            assertPrec(0, await this.mocFunctions.acBalanceOf(mocImpl.address));
          });
          describe("WHEN Bob tries to redeem again", async function () {
            it("THEN it fails as he has no TPs left", async function () {
              await expect(this.mocFunctions.liqRedeemTP({ i: 1, from: bob })).to.be.revertedWithCustomError(
                mocImpl,
                ERRORS.INSUFFICIENT_TP_TO_REDEEM,
              );
            });
          });
        });
        describe("WHEN otherUser tries to redeem TPs by liquidation redeem", async function () {
          it("THEN it fails", async function () {
            await expect(this.mocFunctions.liqRedeemTP({ i: 1, from: otherUser })).to.be.reverted;
          });
        });
      });
    });
    const liquidateProtocol = async function () {
      await priceProviders[0].poke(pEth(0.1));
      await priceProviders[1].poke(pEth(0.1));
      await mocImpl.setLiqEnabled(true);
      await mocImpl.evalLiquidation();
    };
    const expectLiquidatedEvent = async (result: any) =>
      expect(result).to.emit(mocQueue, "UnhandledError").withArgs(anyValue, ERROR_SELECTOR.LIQUIDATED); // operID is not relevant here

    describe("WHEN alice enqueue a mintTC operation", function () {
      beforeEach(async function () {
        await this.mocFunctions.mintTC({ from: alice, qTC: 1, execute: false });
      });
      describe("AND protocol is liquidated", function () {
        beforeEach(async function () {
          await liquidateProtocol();
        });
        describe("WHEN queue is executed", function () {
          it("THEN Operations fails with Unhandled Error", async function () {
            await expectLiquidatedEvent(this.mocFunctions.executeQueue());
            // tokens are returned
            assertPrec(await mocImpl.qACLockedInPending(), 0);
          });
        });
      });
    });
    describe.skip("WHEN alice enqueue a redeemTC operation", function () {
      // TODO: operation reverts because TC is paused and cannot be returned
      beforeEach(async function () {
        await this.mocFunctions.redeemTC({ from: alice, qTC: 1, execute: false });
      });
      describe("AND protocol is liquidated", function () {
        beforeEach(async function () {
          await liquidateProtocol();
        });
        describe("WHEN queue is executed", function () {
          it("THEN Operations fails with Unhandled Error", async function () {
            await expectLiquidatedEvent(this.mocFunctions.executeQueue());
            // tokens are returned
            assertPrec(await this.mocFunctions.tcBalanceOf(mocImpl.address), 0);
          });
        });
      });
    });
    describe("WHEN alice enqueue a mintTP operation", function () {
      beforeEach(async function () {
        await this.mocFunctions.mintTP({ from: alice, qTP: 1, execute: false });
      });
      describe("AND protocol is liquidated", function () {
        beforeEach(async function () {
          await liquidateProtocol();
        });
        describe("WHEN queue is executed", function () {
          it("THEN Operations fails with Unhandled Error", async function () {
            await expectLiquidatedEvent(this.mocFunctions.executeQueue());
            // tokens are returned
            assertPrec(await mocImpl.qACLockedInPending(), 0);
          });
        });
      });
    });
    describe("WHEN bob enqueue a redeemTP operation", function () {
      beforeEach(async function () {
        await this.mocFunctions.redeemTP({ from: bob, qTP: 3, execute: false });
      });
      describe("AND protocol is liquidated", function () {
        beforeEach(async function () {
          await liquidateProtocol();
        });
        describe("WHEN queue is executed", function () {
          it("THEN Operations fails with Unhandled Error", async function () {
            await expectLiquidatedEvent(this.mocFunctions.executeQueue());
            // tokens are returned
            assertPrec(await this.mocFunctions.tpBalanceOf(0, mocImpl.address), 0);
          });
        });
      });
    });
    describe("WHEN bob enqueue a swapTPforTP operation", function () {
      beforeEach(async function () {
        await this.mocFunctions.swapTPforTP({ iFrom: 0, iTo: 1, from: bob, qTP: 3, execute: false });
      });
      describe("AND protocol is liquidated", function () {
        beforeEach(async function () {
          await liquidateProtocol();
        });
        describe("WHEN queue is executed", function () {
          it("THEN Operations fails with Unhandled Error", async function () {
            await expectLiquidatedEvent(this.mocFunctions.executeQueue());
            // tokens are returned
            assertPrec(await this.mocFunctions.tpBalanceOf(0, mocImpl.address), 0);
          });
        });
      });
    });
    describe("WHEN bob enqueue a swapTPforTC operation", function () {
      beforeEach(async function () {
        await this.mocFunctions.swapTPforTC({ from: bob, qTP: 3, execute: false });
      });
      describe("AND protocol is liquidated", function () {
        beforeEach(async function () {
          await liquidateProtocol();
        });
        describe("WHEN queue is executed", function () {
          it("THEN Operations fails with Unhandled Error", async function () {
            await expectLiquidatedEvent(this.mocFunctions.executeQueue());
            // tokens are returned
            assertPrec(await this.mocFunctions.tpBalanceOf(0, mocImpl.address), 0);
          });
        });
      });
    });
    describe.skip("WHEN alice enqueue a swapTCforTP operation", function () {
      // TODO: operation reverts because TC is paused and cannot be returned
      beforeEach(async function () {
        await this.mocFunctions.swapTCforTP({ from: alice, qTC: 10, execute: false });
      });
      describe("AND protocol is liquidated", function () {
        beforeEach(async function () {
          await liquidateProtocol();
        });
        describe("WHEN queue is executed", function () {
          it("THEN Operations fails with Unhandled Error", async function () {
            await expectLiquidatedEvent(this.mocFunctions.executeQueue());
            // tokens are returned
            assertPrec(await this.mocFunctions.tcBalanceOf(mocImpl.address), 0);
          });
        });
      });
    });
    describe.skip("WHEN alice enqueue a redeemTCandTP operation", function () {
      // TODO: operation reverts because TC is paused and cannot be returned
      beforeEach(async function () {
        await this.mocFunctions.redeemTCandTP({ from: alice, qTC: 10, qTP: 1, execute: false });
      });
      describe("AND protocol is paused", function () {
        describe("AND protocol is liquidated", function () {
          beforeEach(async function () {
            await liquidateProtocol();
          });
          describe("WHEN queue is executed", function () {
            it("THEN Operations fails with Unhandled Error", async function () {
              await expectLiquidatedEvent(this.mocFunctions.executeQueue());
              // tokens are returned
              assertPrec(await this.mocFunctions.tcBalanceOf(mocImpl.address), 0);
              assertPrec(await this.mocFunctions.tpBalanceOf(0, mocImpl.address), 0);
            });
          });
        });
      });
    });
    describe("WHEN alice enqueue a mintTCandTP operation", function () {
      beforeEach(async function () {
        await this.mocFunctions.mintTCandTP({ from: alice, qTP: 3, execute: false });
      });
      describe("AND protocol is liquidated", function () {
        beforeEach(async function () {
          await liquidateProtocol();
        });
        describe("WHEN queue is executed", function () {
          it("THEN Operations fails with Unhandled Error", async function () {
            await expectLiquidatedEvent(this.mocFunctions.executeQueue());
            // tokens are returned
            assertPrec(await mocImpl.qACLockedInPending(), 0);
          });
        });
      });
    });
  });
};

export { shouldBehaveLikeLiquidable };
