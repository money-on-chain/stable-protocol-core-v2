// @ts-nocheck
import { getNamedAccounts, ethers } from "hardhat";
import { Address } from "hardhat-deploy/dist/types";
import { mineNBlocks, pEth, simParams } from "../helpers/utils";

const gasEstimationExecBehavior = function (tpAmount: number, iterations: number, avgQueueSize: number) {
  let mocContracts: any;
  let mocFncs: any;
  let alice: Address;
  let bob: Address;
  let charlie: Address;
  let vendor: Address;
  let gasSummaries = {};
  const { gasPrice, btcUsdPrice } = simParams();

  const gasData = (currStats, gasUsed: number) => ({
    count: currStats.count + 1,
    min: Math.min(currStats.min, gasUsed),
    avg: currStats.avg + gasUsed,
    max: Math.max(currStats.max, gasUsed),
  });

  const setStats = async (op, operationsInBatch, tx) => {
    const txReceipt = await tx.wait();
    const failed = txReceipt.events.some(it => it.event === "OperationError" || it.event === "UnhandledError");
    // Failed operations shouldn't be accounted
    if (failed) {
      console.log("FAILED OPERATION !!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      return;
    }
    const gasUsedPerOper = txReceipt.gasUsed.toNumber() / operationsInBatch;
    gasSummaries[op] = gasData(gasSummaries[op], gasUsedPerOper);
  };

  describe("Feature: queue executing gas estimation per Operation Type", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFncs = this.mocFunctions;
      ({ alice, bob, charlie, vendor } = await getNamedAccounts());
      // initialize bucket to not skip the functions where there are comparisons with 0
      await mocFncs.mintTC({ from: alice, qTC: 10e9 });
      await Promise.all(mocContracts.mocPeggedTokens.map((p, i) => mocFncs.mintTP({ i, from: alice, qTP: 10e6 })));
      // Guarantee Alice has fee Token Balance
      await mocContracts.feeToken.mint(alice, pEth(10e3));
    });

    it("RESULTS:", async function () {
      const getParams = (index: number) => {
        const i = index % tpAmount;
        const iTo = (index + 1) % tpAmount;
        const result = { i, iFrom: i, iTo, from: alice, qTC: 1, qTP: 100, execute: false };
        // Ensure at least on time we get the max and min cases
        if (index == 0) {
          result.to = undefined;
          result.vendor = undefined;
        } else if (index == 1) {
          result.to = bob;
          result.vendor = vendor;
        } else {
          // Randomly sends funds to other user or himself (undefined)
          result.to = [undefined, alice, bob, charlie][(Math.random() * 4).toFixed(0)];
          // Use Vendors 80 % of the time
          result.vendor = Math.random() > 0.2 ? vendor : undefined;
        }
        return result;
      };

      const operWrap = (index, f) => async args => {
        let feeTokenProbability = Math.random();
        // Ensure at least on time we get the min (index = 0) and max (index = 1) cases
        if (index == 0) {
          feeTokenProbability = 0;
        } else if (index == 1) {
          feeTokenProbability = 1;
        }
        // Use fee Token ~50% of the time
        await mocContracts.feeToken
          .connect(await ethers.getSigner(alice))
          .approve(mocContracts.mocImpl.address, pEth(feeTokenProbability > 0.5 ? 100 : 0));
        return f(args);
      };
      const ops = {
        mintTC: (i: number) => operWrap(i, mocFncs.mintTC)({ ...getParams(i) }),
        redeemTC: (i: number) => operWrap(i, mocFncs.redeemTC)(getParams(i)),
        mintTP: (i: number) => operWrap(i, mocFncs.mintTP)(getParams(i)),
        redeemTP: (i: number) => operWrap(i, mocFncs.redeemTP)(getParams(i)),
        swapTPforTC: (i: number) => operWrap(i, mocFncs.swapTPforTC)(getParams(i)),
        swapTCforTP: (i: number) => operWrap(i, mocFncs.swapTCforTP)(getParams(i)),
        redeemTCandTP: (i: number) => operWrap(i, mocFncs.redeemTCandTP)(getParams(i)),
        mintTCandTP: (i: number) => operWrap(i, mocFncs.mintTCandTP)(getParams(i)),
      };
      if (tpAmount > 1) {
        ops.swapTPforTP = (i: number) => mocFncs.swapTPforTP(getParams(i));
      }
      for (let i = 0; i < iterations; i++) {
        for (let op of Object.keys(ops)) {
          if (i == 0) {
            gasSummaries[op] = { min: Number.MAX_SAFE_INTEGER, max: 0, avg: 0, count: 0 };
          }
          const batchSize = Math.max(1, (Math.random() * avgQueueSize).toFixed(0));
          for (let j = 0; j < batchSize; j++) {
            await mineNBlocks((Math.random() * 5).toFixed(0));
            await Promise.all(
              Array.from(Array(tpAmount).keys()).map(i => mocFncs.pokePrice(i, 0.95 + Math.random() / 10)),
            );

            // queue de Operation
            await ops[op](i + j);
          }
          await setStats(op, batchSize, await mocFncs.executeQueue());
        }
      }
      for (let op of Object.keys(ops)) {
        gasSummaries[op].avg = (gasSummaries[op].avg / gasSummaries[op].count).toFixed(0);
        gasSummaries[op].min = gasSummaries[op].min.toFixed(0);
        gasSummaries[op].max = gasSummaries[op].max.toFixed(0);
        gasSummaries[op]["~fee USD"] = ((gasSummaries[op].avg * gasPrice * btcUsdPrice) / 1e18).toFixed(2);
      }
      console.table(gasSummaries);
    }).timeout(10e6);
  });
};

export { gasEstimationExecBehavior };
