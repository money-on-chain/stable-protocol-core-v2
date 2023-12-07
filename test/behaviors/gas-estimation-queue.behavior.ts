// @ts-nocheck
import { getNamedAccounts } from "hardhat";
import { Address } from "hardhat-deploy/dist/types";
import { expect } from "chai";
import { mineUpTo } from "../helpers/utils";

const gasEstimationBehavior = function () {
  let mocContracts: any;
  let mocFunctions: any;
  let deployer: Address;
  let gasSummaries = {};
  const gasPrice = 65164000;
  const blockGasLimit = 6800000;
  const TP_0 = 0;
  const TP_1 = 1;

  const gasData = (estimatedGas: number) => ({
    blockGasLimit,
    estimatedGas: estimatedGas,
    gasLeftPct: (((blockGasLimit - estimatedGas) / blockGasLimit) * 100).toFixed(2) + "%",
    gasPrice,
    gasFee: (estimatedGas * gasPrice) / 1e18,
    "fee (USD at 30k)": ((estimatedGas * gasPrice * 30000) / 1e18).toFixed(2),
  });

  const setGasUsed = async (op, tx) => {
    const gasUsed = (await tx.wait()).gasUsed.toNumber();
    Object.assign(gasSummaries, { [op]: gasData(gasUsed) });
  };

  describe("Feature: queuing gas estimation", function () {
    beforeEach(async function () {
      mocContracts = this.mocContracts;
      mocFunctions = this.mocFunctions;
      ({ deployer } = await getNamedAccounts());
    });
    describe("GIVEN some open positions", function () {
      beforeEach(async function () {
        // initialize bucket to not skip the functions where there are comparisons with 0
        await mocFunctions.mintTC({ from: deployer, qTC: 1000000 });
        await Promise.all(
          mocContracts.mocPeggedTokens.map((p, i) => mocFunctions.mintTP({ i, from: deployer, qTP: 1000 })),
        );
      });
      describe("WHEN executes Moc operations", function () {
        it("THEN block gas left is over 50% of block gas limit in each one", async function () {
          const common = { from: deployer, qTC: 1, qTP: 100, execute: false };
          const ops = {
            mintTC: () => mocFunctions.mintTC({ ...common }),
            redeemTC: () => mocFunctions.redeemTC({ ...common }),
            mintTP: () => mocFunctions.mintTP({ ...common }),
            redeemTP: () => mocFunctions.redeemTP({ ...common }),
            swapTPforTP: () => mocFunctions.swapTPforTP({ iFrom: TP_0, iTo: TP_1, ...common }),
            swapTPforTC: () => mocFunctions.swapTPforTC({ ...common }),
            swapTCforTP: () => mocFunctions.swapTCforTP({ ...common }),
            redeemTCandTP: () => mocFunctions.redeemTCandTP({ ...common }),
            mintTCandTP: () => mocFunctions.mintTCandTP({ ...common }),
            execSettlement: async () => {
              await mineUpTo(await mocContracts.mocImpl.bns());
              return mocContracts.mocImpl.execSettlement();
            },
          };

          for (let op of Object.keys(ops)) {
            await setGasUsed(op, await ops[op]());
            // gas spent should be less than 50% of block gas limit
            expect(gasSummaries[op].estimatedGas, op).lt(blockGasLimit / 2);
          }
          console.table(gasSummaries);
        }).timeout(10e6);
      });
    });
  });
};

export { gasEstimationBehavior };
