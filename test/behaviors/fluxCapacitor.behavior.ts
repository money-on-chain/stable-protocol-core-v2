import { getNamedAccounts, network } from "hardhat";
import { time, mine } from "@nomicfoundation/hardhat-network-helpers";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { assertPrec } from "../helpers/assertHelper";
import { ERRORS, pEth } from "../helpers/utils";
import { MocCACoinbase, MocCARC20, MocCARC20Deferred } from "../../typechain";

const fluxCapacitorBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let mocImpl: MocCACoinbase | MocCARC20 | MocCARC20Deferred;
  let alice: Address;
  const TP_0 = 0;
  const TP_1 = 1;
  let tp0: Address;
  let tp1: Address;
  let lastOperationBlockNumber: Number;
  let opOneBlock: (op: any) => Promise<any>;

  describe("Feature: flux capacitor", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ mocImpl } = mocContracts);
      ({ alice } = await getNamedAccounts());
      tp0 = mocContracts.mocPeggedTokens[TP_0].address;
      tp1 = mocContracts.mocPeggedTokens[TP_1].address;

      // add collateral
      await mocFunctions.mintTC({ from: alice, qTC: 100000000 });
      // initialize alice with some TP0
      await mocFunctions.mintTP({ from: alice, qTP: 23500000 });

      await mocContracts.maxAbsoluteOpProviders[TP_0].poke(pEth(10000));
      await mocContracts.maxOpDiffProviders[TP_0].poke(pEth(5000));
      // reset accumulators
      await mine(10000);

      // depending on the flavour the operations could take different amount of blocks
      // to simplify math related to the decay factor we execute them in the same block
      opOneBlock = async (op: any) => {
        // stop hardhat auto mine configuration
        await network.provider.send("evm_setAutomine", [false]);
        const tx = await op();
        // start hardhat auto mine configuration
        await network.provider.send("evm_setAutomine", [true]);
        // mine block manually
        await network.provider.send("evm_mine");
        return tx;
      };
    });
    describe("WHEN 10001 AC are used to mint TP0", () => {
      it("THEN fails because max absolute operation was reached", async () => {
        await expect(
          opOneBlock(() => mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 2350235 })),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_FLUX_CAPACITOR_OPERATION);
      });
    });
    describe("WHEN 10001 AC are redeemed from TP0", () => {
      it("THEN fails because max absolute operation was reached", async () => {
        // 10001 AC / 0.95(5% fees) * 235 pACtp = 2473931
        await expect(
          opOneBlock(() => mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: 2473931 })),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_FLUX_CAPACITOR_OPERATION);
      });
    });
    describe("WHEN 10001 AC are used to swap TP0 for TP1", () => {
      it("THEN fails because max absolute operation was reached", async () => {
        await expect(
          opOneBlock(() => mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 2350235 })),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_FLUX_CAPACITOR_OPERATION);
      });
    });
    describe("WHEN 10000 AC are used to swap TP0 for TP1", () => {
      beforeEach(async () => {
        await opOneBlock(() => mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 2350000 }));
      });
      it("THEN absolute accumulator is 10000 and differential accumulator is -10000 in TP0", async () => {
        assertPrec(await mocImpl.absoluteAccumulator(tp0), 10000);
        assertPrec(await mocImpl.differentialAccumulator(tp0), -10000);
      });
      it("THEN absolute and differential accumulators are in 10000 in TP1", async () => {
        assertPrec(await mocImpl.absoluteAccumulator(tp1), 10000);
        assertPrec(await mocImpl.differentialAccumulator(tp1), 10000);
      });
    });
    describe("WHEN 10001 AC are used to swap TP0 for TC", () => {
      it("THEN fails because max absolute operation was reached", async () => {
        await expect(
          opOneBlock(() => mocFunctions.swapTPforTC({ i: TP_0, from: alice, qTP: 2350235 })),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_FLUX_CAPACITOR_OPERATION);
      });
    });
    describe("WHEN 10000 AC are used to swap TP0 for TC", () => {
      beforeEach(async () => {
        await opOneBlock(() => mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, from: alice, qTP: 2350000 }));
      });
      it("THEN absolute accumulator is 10000 and differential accumulator is -10000 in TP0", async () => {
        assertPrec(await mocImpl.absoluteAccumulator(tp0), 10000);
        assertPrec(await mocImpl.differentialAccumulator(tp0), -10000);
      });
    });
    describe("WHEN 10001 AC are used to swap TC for TP0", () => {
      it("THEN fails because max absolute operation was reached", async () => {
        await expect(
          opOneBlock(() => mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 10001 })),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_FLUX_CAPACITOR_OPERATION);
      });
    });
    describe("WHEN 10000 AC are used to swap TC for TP0", () => {
      beforeEach(async () => {
        await opOneBlock(() => mocFunctions.swapTCforTP({ i: TP_0, from: alice, qTC: 10000 }));
      });
      it("THEN absolute and differential accumulators are in 10000 in TP0", async () => {
        assertPrec(await mocImpl.absoluteAccumulator(tp0), 10000);
        assertPrec(await mocImpl.differentialAccumulator(tp0), 10000);
      });
    });
    describe("WHEN 10001 AC are used to mint TC and TP", () => {
      it("THEN fails because max absolute operation was reached", async () => {
        await expect(
          opOneBlock(() => mocFunctions.mintTCandTP({ i: TP_0, from: alice, qTP: 2350235 })),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_FLUX_CAPACITOR_OPERATION);
      });
    });
    describe("WHEN 10000 AC are used to mint TC and TP", () => {
      beforeEach(async () => {
        await opOneBlock(() => mocFunctions.mintTCandTP({ i: TP_0, from: alice, qTP: 2350000 }));
      });
      it("THEN absolute and differential accumulators are in 10000 in TP0", async () => {
        assertPrec(await mocImpl.absoluteAccumulator(tp0), 10000);
        assertPrec(await mocImpl.differentialAccumulator(tp0), 10000);
      });
    });
    describe("WHEN 10001 AC are used to redeem TC and TP0", () => {
      it("THEN fails because max absolute operation was reached", async () => {
        await expect(
          opOneBlock(() => mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 10000001, qTP: 2350235 })),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.INVALID_FLUX_CAPACITOR_OPERATION);
      });
    });
    describe("WHEN 10000 AC are used to redeem TC and TP0", () => {
      beforeEach(async () => {
        await opOneBlock(() => mocFunctions.redeemTCandTP({ i: TP_0, from: alice, qTC: 10000000, qTP: 2350000 }));
      });
      it("THEN absolute and differential accumulators are in 10000 in TP0", async () => {
        assertPrec(await mocImpl.absoluteAccumulator(tp0), 10000);
        assertPrec(await mocImpl.differentialAccumulator(tp0), -10000);
      });
    });
    describe("WHEN maxAbsoluteOpProviders is deprecated", () => {
      beforeEach(async () => {
        await mocContracts.maxAbsoluteOpProviders[TP_0].deprecateDataProvider();
      });
      it("THEN mint TP fails because there is not a max absolute operation provider", async () => {
        await expect(
          opOneBlock(() => mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500 })),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.MISSING_PROVIDER_DATA);
      });
    });
    describe("WHEN maxOpDiffProviders is deprecated", () => {
      beforeEach(async () => {
        await mocContracts.maxOpDiffProviders[TP_0].deprecateDataProvider();
      });
      it("THEN mint TP fails because there is not a max operation difference provider", async () => {
        await expect(
          opOneBlock(() => mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 23500 })),
        ).to.be.revertedWithCustomError(mocImpl, ERRORS.MISSING_PROVIDER_DATA);
      });
    });
    describe("WHEN 6000 AC are used to mint TP0", () => {
      beforeEach(async () => {
        await opOneBlock(() => mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 1410000 }));
        lastOperationBlockNumber = await time.latestBlock();
      });
      it("THEN absolute and differential accumulators are in 6000", async () => {
        assertPrec(await mocImpl.absoluteAccumulator(tp0), 6000);
        assertPrec(await mocImpl.differentialAccumulator(tp0), 6000);
      });
      it("THEN last operation block is update", async () => {
        expect(await mocImpl.lastOperationBlockNumber(tp0)).to.be.equal(lastOperationBlockNumber);
      });
      it("THEN there are 4002 AC allowed to mint TP0 and 2500 AC allowed to redeem TP0", async () => {
        assertPrec(await mocImpl.maxQACToMintTP(tp0), "4002.083333333333332000");
        assertPrec(await mocImpl.maxQACToRedeemTP(tp0), 2500);
      });
      describe("WHEN 4003 AC are used to mint TP0", () => {
        it("THEN fails because max absolute operation was reached ", async () => {
          await expect(
            opOneBlock(() => mocFunctions.mintTP({ i: TP_0, from: alice, qTP: 940705 })),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.MAX_FLUX_CAPACITOR_REACHED);
        });
      });
      describe("WHEN 2501 AC are redeemed from TP0", () => {
        it("THEN fails because max operational difference was reached ", async () => {
          // 2501 AC / 0.95(5% fees) * 235 pACtp = 618668
          await expect(
            opOneBlock(() => mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: 618668 })),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.MAX_FLUX_CAPACITOR_REACHED);
        });
      });
      describe("AND maxAbsoluteOpProviders is set to 2000 AC, below actual accumulators value", () => {
        beforeEach(async () => {
          await await mocContracts.maxAbsoluteOpProviders[TP_0].poke(pEth(2000));
        });
        it("THEN there are 0 AC allowed to mint or redeem TP0", async () => {
          assertPrec(await mocImpl.maxQACToMintTP(tp0), 0);
          assertPrec(await mocImpl.maxQACToRedeemTP(tp0), 0);
        });
      });
      describe("AND 288 block are mined, 10% of decay factor", () => {
        beforeEach(async () => {
          await mine(287);
        });
        describe("WHEN 2000 AC are redeemed from TP0", () => {
          beforeEach(async () => {
            // 2000 AC / 0.95(5% fees) * 235 pACtp = 494736.84
            await opOneBlock(() => mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: "494736.842105263157894700" }));
          });
          it("THEN absolute accumulator is 7400 and differential accumulator is 3400", async () => {
            // absolute = (6000 * 0.9) + 2000
            // differential = (6000 * 0.9) - 2000
            assertPrec(await mocImpl.absoluteAccumulator(tp0), 7400);
            assertPrec(await mocImpl.differentialAccumulator(tp0), 3400);
          });
          it("THEN there are 2602 AC allowed to mint TP0 and 500 AC allowed to redeem TP0", async () => {
            assertPrec(await mocImpl.maxQACToMintTP(tp0), "2602.569444444444442800");
            assertPrec(await mocImpl.maxQACToRedeemTP(tp0), "500.694444444444444000");
          });
          describe("AND maxOpDiffProviders is set to 2000 AC, below actual accumulators value", () => {
            beforeEach(async () => {
              await await mocContracts.maxOpDiffProviders[TP_0].poke(pEth(2000));
            });
            it("THEN there are 0 AC allowed to mint or redeem TP0", async () => {
              assertPrec(await mocImpl.maxQACToMintTP(tp0), 0);
              assertPrec(await mocImpl.maxQACToRedeemTP(tp0), 0);
            });
          });
        });
      });
      describe("AND 2880 block are mined, 100% of decay factor", () => {
        beforeEach(async () => {
          await mine(2880);
        });
        it("THEN absolute and differential accumulators were reset", async () => {
          assertPrec(await mocImpl.maxQACToMintTP(tp0), 10000);
          assertPrec(await mocImpl.maxQACToRedeemTP(tp0), 10000);
        });
        describe("WHEN 2000 AC are redeemed from TP0", () => {
          beforeEach(async () => {
            // 2000 AC / 0.95(5% fees) * 235 pACtp = 494736.84
            await opOneBlock(() => mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: "494736.842105263157894700" }));
          });
          it("THEN absolute accumulator is 2000 and differential accumulator is -2000", async () => {
            assertPrec(await mocImpl.absoluteAccumulator(tp0), 2000);
            assertPrec(await mocImpl.differentialAccumulator(tp0), -2000);
          });
          it("THEN there are 8000 AC allowed to mint or redeem TP0", async () => {
            assertPrec(await mocImpl.maxQACToMintTP(tp0), "8000.694444444444444000");
            assertPrec(await mocImpl.maxQACToRedeemTP(tp0), "8000.694444444444444000");
          });
        });
        describe("WHEN 3000 AC are redeemed from TP0", () => {
          beforeEach(async () => {
            // 3000 AC / 0.95(5% fees) * 235 pACtp = 494736.84
            await opOneBlock(() => mocFunctions.redeemTP({ i: TP_0, from: alice, qTP: "742105.263157894736842100" }));
          });
          it("THEN absolute accumulator is 3000 and differential accumulator is -3000", async () => {
            assertPrec(await mocImpl.absoluteAccumulator(tp0), 3000);
            assertPrec(await mocImpl.differentialAccumulator(tp0), -3000);
          });
          it("THEN there are 2500 AC allowed to mint TP0 and 7000 AC to redeem TP0", async () => {
            assertPrec(await mocImpl.maxQACToMintTP(tp0), 2500);
            assertPrec(await mocImpl.maxQACToRedeemTP(tp0), "7001.041666666666666000");
          });
        });
      });
    });
  });
};

export { fluxCapacitorBehavior };
