import { getNamedAccounts, network } from "hardhat";
import { time, mine } from "@nomicfoundation/hardhat-network-helpers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { assertPrec } from "../helpers/assertHelper";
import { ERRORS, pEth } from "../helpers/utils";
import { MocCACoinbase, MocCARC20 } from "../../typechain";

const fluxCapacitorBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20;
  let alice: Address;
  let lastOperationBlockNumber: Number;
  const TP_1 = 1;
  // depending on the flavour the operations could take different amount of blocks
  // to simplify math related to the decay factor we execute them in the same block
  let opOneBlock = async function (op: () => Promise<any>) {
    // stop hardhat auto mine configuration
    await network.provider.send("evm_setAutomine", [false]);
    const tx = await op();
    // mine block manually
    await network.provider.send("evm_mine");
    // start hardhat auto mine configuration
    await network.provider.send("evm_setAutomine", [true]);
    return tx;
  };
  describe("Feature: flux capacitor", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ mocImpl } = mocContracts);
      ({ alice } = await getNamedAccounts());

      // add collateral
      await mocFunctions.mintTC({ from: alice, qTC: 200000000 });
      // initialize alice with some TP0
      await mocFunctions.mintTP({ from: alice, qTP: 23500000 });
      // reset accumulators
      await mine(1000);
      // initialize alice with some TP1
      await mocFunctions.mintTP({ i: TP_1, from: alice, qTP: 525000 });
      // reset accumulators
      await mine(3000);
      await mocContracts.maxAbsoluteOpProvider.poke(pEth(10000));
      await mocContracts.maxOpDiffProvider.poke(pEth(5000));
    });
    describe("WHEN 10001 AC are used to mint TP0", function () {
      it("THEN fails because max absolute operation was reached", async function () {
        await expect(
          opOneBlock(() => mocFunctions.mintTP({ from: alice, qTP: 2350235 })),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_FLUX_CAPACITOR_OPERATION);
      });
    });
    describe("WHEN 10001 AC are redeemed from TP0", function () {
      it("THEN fails because max absolute operation was reached", async function () {
        // 10001 AC / 0.95(5% fees) * 235 pACtp = 2473931
        await expect(
          opOneBlock(() => mocFunctions.redeemTP({ from: alice, qTP: 2473931 })),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_FLUX_CAPACITOR_OPERATION);
      });
    });
    describe("WHEN 10001 AC are used to swap TP0 for TC", function () {
      it("THEN fails because max absolute operation was reached", async function () {
        await expect(
          opOneBlock(() => mocFunctions.swapTPforTC({ from: alice, qTP: 2350235 })),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_FLUX_CAPACITOR_OPERATION);
      });
    });
    describe("WHEN 10000 AC are used to swap TP0 for TC", function () {
      beforeEach(async () => {
        await opOneBlock(() => mocFunctions.swapTPforTC({ from: alice, qTP: 2350000 }));
      });
      it("THEN absolute accumulator is 10000 and differential accumulator is -10000", async () => {
        assertPrec(await mocImpl.absoluteAccumulator(), 10000);
        assertPrec(await mocImpl.differentialAccumulator(), -10000);
      });
    });
    describe("WHEN 10001 AC are used to swap TC for TP0", function () {
      it("THEN fails because max absolute operation was reached", async function () {
        await expect(
          opOneBlock(() => mocFunctions.swapTCforTP({ from: alice, qTC: 10001 })),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_FLUX_CAPACITOR_OPERATION);
      });
    });
    describe("WHEN 10000 AC are used to swap TC for TP0", function () {
      beforeEach(async function () {
        await opOneBlock(() => mocFunctions.swapTCforTP({ from: alice, qTC: 10000 }));
      });
      it("THEN absolute and differential accumulators are in 10000", async function () {
        assertPrec(await mocImpl.absoluteAccumulator(), 10000);
        assertPrec(await mocImpl.differentialAccumulator(), 10000);
      });
    });
    describe("WHEN 10001 AC are used to mint TC and TP", function () {
      it("THEN fails because max absolute operation was reached", async function () {
        await expect(
          opOneBlock(() => mocFunctions.mintTCandTP({ from: alice, qTP: 2350235 })),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_FLUX_CAPACITOR_OPERATION);
      });
    });
    describe("WHEN 10000 AC are used to mint TC and TP", function () {
      beforeEach(async function () {
        await opOneBlock(() => mocFunctions.mintTCandTP({ from: alice, qTP: 2350000 }));
      });
      it("THEN absolute and differential accumulators are in 10000", async function () {
        assertPrec(await mocImpl.absoluteAccumulator(), 10000);
        assertPrec(await mocImpl.differentialAccumulator(), 10000);
      });
    });
    describe("WHEN 10001 AC are used to redeem TC and TP0", function () {
      it("THEN fails because max absolute operation was reached", async function () {
        await expect(
          opOneBlock(() =>
            mocFunctions.redeemTCandTP({ from: alice, qTC: "11766024.902394024462400000", qTP: 2350235 }),
          ),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_FLUX_CAPACITOR_OPERATION);
      });
    });
    describe("WHEN 10000 AC are used to redeem TC and TP0", function () {
      beforeEach(async function () {
        await opOneBlock(() =>
          mocFunctions.redeemTCandTP({ from: alice, qTC: "11764848.417552269235530000", qTP: 2350001 }),
        );
      });
      it("THEN absolute and differential accumulators are in 10000", async function () {
        assertPrec(await mocImpl.absoluteAccumulator(), 10000);
        assertPrec(await mocImpl.differentialAccumulator(), -10000);
      });
    });
    describe("WHEN maxAbsoluteOpProviders is deprecated", function () {
      beforeEach(async function () {
        await mocContracts.maxAbsoluteOpProvider.deprecateDataProvider();
      });
      it("THEN mint TP fails because there is not a max absolute operation provider", async function () {
        await expect(opOneBlock(() => mocFunctions.mintTP({ from: alice, qTP: 23500 }))).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.MISSING_PROVIDER_DATA,
        );
      });
    });
    describe("WHEN maxOpDiffProviders is deprecated", function () {
      beforeEach(async function () {
        await mocContracts.maxOpDiffProvider.deprecateDataProvider();
      });
      it("THEN mint TP fails because there is not a max operation difference provider", async function () {
        await expect(opOneBlock(() => mocFunctions.mintTP({ from: alice, qTP: 23500 }))).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.MISSING_PROVIDER_DATA,
        );
      });
    });
    describe("WHEN 6000 AC are used to mint TP0", function () {
      beforeEach(async function () {
        await opOneBlock(() => mocFunctions.mintTP({ from: alice, qTP: 1410000 }));
        lastOperationBlockNumber = await time.latestBlock();
      });
      it("THEN absolute and differential accumulators are in 6000", async function () {
        assertPrec(await mocImpl.absoluteAccumulator(), 6000);
        assertPrec(await mocImpl.differentialAccumulator(), 6000);
      });
      it("THEN last operation block is update", async function () {
        expect(await mocImpl.lastOperationBlockNumber()).to.be.equal(lastOperationBlockNumber);
      });
      it("THEN there are 4002 AC allowed to mint TP and 2500 AC allowed to redeem TP", async function () {
        assertPrec(await mocImpl.maxQACToMintTP(), "4002.083333333333332000");
        assertPrec(await mocImpl.maxQACToRedeemTP(), 2500);
      });
      describe("WHEN 4003 AC are used to mint TP0", function () {
        it("THEN fails because max absolute operation was reached", async function () {
          await expect(
            opOneBlock(() => mocFunctions.mintTP({ from: alice, qTP: 940705 })),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.MAX_FLUX_CAPACITOR_REACHED);
        });
      });
      describe("WHEN 4003 AC are used to mint TP1", function () {
        it("THEN fails because max absolute operation was reached", async function () {
          await expect(
            opOneBlock(() => mocFunctions.mintTP({ i: TP_1, from: alice, qTP: 21015.75 })),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.MAX_FLUX_CAPACITOR_REACHED);
        });
      });
      describe("WHEN 2501 AC are redeemed from TP0", function () {
        it("THEN fails because max operational difference was reached", async function () {
          // 2501 AC / 0.95(5% fees) * 235 pACtp = 618668
          await expect(
            opOneBlock(() => mocFunctions.redeemTP({ from: alice, qTP: 618668 })),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.MAX_FLUX_CAPACITOR_REACHED);
        });
      });
      describe("WHEN 2501 AC are redeemed from TP1", function () {
        it("THEN fails because max operational difference was reached", async function () {
          // 2501 AC / 0.95(5% fees) * 5.25 pACtp = 13821
          await expect(
            opOneBlock(() => mocFunctions.redeemTP({ i: TP_1, from: alice, qTP: 13821 })),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.MAX_FLUX_CAPACITOR_REACHED);
        });
      });
      describe("AND maxAbsoluteOpProviders is set to 2000 AC, below actual accumulators value", function () {
        beforeEach(async function () {
          await await mocContracts.maxAbsoluteOpProvider.poke(pEth(2000));
        });
        it("THEN there are 0 AC allowed to mint or redeem TP", async function () {
          assertPrec(await mocImpl.maxQACToMintTP(), 0);
          assertPrec(await mocImpl.maxQACToRedeemTP(), 0);
        });
      });
      describe("AND 288 block are mined, 10% of decay factor", function () {
        beforeEach(async function () {
          await mine(287);
        });
        describe("WHEN 2000 AC are redeemed from TP0", function () {
          beforeEach(async function () {
            // 2000 AC / 0.95(5% fees) * 235 pACtp = 494736.84
            await opOneBlock(() => mocFunctions.redeemTP({ from: alice, qTP: "494736.842105263157894700" }));
          });
          it("THEN absolute accumulator is 7400 and differential accumulator is 3400", async function () {
            // absolute = (6000 * 0.9) + 2000
            // differential = (6000 * 0.9) - 2000
            assertPrec(await mocImpl.absoluteAccumulator(), 7400);
            assertPrec(await mocImpl.differentialAccumulator(), 3400);
          });
          it("THEN there are 2602 AC allowed to mint TP and 500 AC allowed to redeem TP", async function () {
            assertPrec(await mocImpl.maxQACToMintTP(), "2602.569444444444442800");
            assertPrec(await mocImpl.maxQACToRedeemTP(), "500.694444444444444000");
          });
          describe("AND maxOpDiffProviders is set to 2000 AC, below actual accumulators value", function () {
            beforeEach(async function () {
              await await mocContracts.maxOpDiffProvider.poke(pEth(2000));
            });
            it("THEN there are 0 AC allowed to mint or redeem TP", async function () {
              assertPrec(await mocImpl.maxQACToMintTP(), 0);
              assertPrec(await mocImpl.maxQACToRedeemTP(), 0);
            });
          });
        });
      });
      describe("AND 2880 block are mined, 100% of decay factor", function () {
        beforeEach(async function () {
          await mine(2880);
        });
        it("THEN absolute and differential accumulators were reset", async function () {
          assertPrec(await mocImpl.maxQACToMintTP(), 10000);
          assertPrec(await mocImpl.maxQACToRedeemTP(), 10000);
        });
        describe("WHEN 2000 AC are redeemed from TP0", function () {
          beforeEach(async function () {
            // 2000 AC / 0.95(5% fees) * 235 pACtp = 494736.84
            await opOneBlock(() => mocFunctions.redeemTP({ from: alice, qTP: "494736.842105263157894700" }));
          });
          it("THEN absolute accumulator is 2000 and differential accumulator is -2000", async function () {
            assertPrec(await mocImpl.absoluteAccumulator(), 2000);
            assertPrec(await mocImpl.differentialAccumulator(), -2000);
          });
          it("THEN there are 8000 AC allowed to mint or redeem TP", async function () {
            assertPrec(await mocImpl.maxQACToMintTP(), "8000.694444444444444000");
            assertPrec(await mocImpl.maxQACToRedeemTP(), "8000.694444444444444000");
          });
        });
        describe("WHEN 3000 AC are redeemed from TP1", function () {
          beforeEach(async function () {
            // 3000 AC / 0.95(5% fees) * 5.25 pACtp = 16578.94
            await opOneBlock(() => mocFunctions.redeemTP({ i: TP_1, from: alice, qTP: "16578.947368421052631578" }));
          });
          it("THEN absolute accumulator is 3000 and differential accumulator is -3000", async function () {
            assertPrec(await mocImpl.absoluteAccumulator(), 3000);
            assertPrec(await mocImpl.differentialAccumulator(), -3000);
          });
          it("THEN there are 2500 AC allowed to mint TP and 7000 AC to redeem TP", async function () {
            assertPrec(await mocImpl.maxQACToMintTP(), 2500);
            assertPrec(await mocImpl.maxQACToRedeemTP(), "7001.041666666666666000");
          });
        });
      });
    });
  });
};

export { fluxCapacitorBehavior };
