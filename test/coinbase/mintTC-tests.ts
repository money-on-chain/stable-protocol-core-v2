import { getNamedAccounts } from "hardhat";
import { fixtureDeployedMocCoinbase } from "./fixture";
import { MocCACoinbase, MocRC20 } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { assertPrec } from "../helpers/assertHelper";
import { Address } from "hardhat-deploy/dist/types";
import { BigNumber } from "@ethersproject/bignumber";

describe("Feature: MocCoinbase mint CT", function () {
  let mocCore: MocCACoinbase;
  let mocCollateralToken: MocRC20;

  let mocFeeFlow: Address;
  let alice: Address;

  let mocFunctions: any;

  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(0);
      ({ mocCore, mocCollateralToken } = await fixtureDeploy());
      ({ mocFeeFlow, alice } = await getNamedAccounts());
      mocFunctions = await mocFunctionsCoinbase({ mocCore, mocCollateralToken });
    });
    describe("WHEN alice sends 100 rbtc to mint Collateral Token", function () {
      [0, 100].forEach(qTC => {
        describe(`AND there are ${qTC} Collateral Token`, function () {
          let mocFeeFlowPrevBalance: BigNumber;
          beforeEach(async function () {
            mocFeeFlowPrevBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
            if (qTC) {
              await mocFunctions.mintTC(alice, qTC);
            }
            await mocFunctions.mintTC(alice, 100);
          });
          it("THEN alice receives 100 Collateral Token", async function () {
            assertPrec(100 + qTC, await mocFunctions.tcBalanceOf(alice));
          });
          it("THEN Moc balance increase 100 rbtc", async function () {
            assertPrec(100 + qTC, await mocFunctions.acBalanceOf(mocCore.address));
          });
          it("THEN Moc Fee Flow receives 5% of 100 rbtc", async function () {
            const mocFeeFlowActualBalance = await mocFunctions.acBalanceOf(mocFeeFlow);
            const diff = mocFeeFlowActualBalance.sub(mocFeeFlowPrevBalance);
            assertPrec((100 + qTC) * 0.05, diff);
          });
        });
      });
    });
  });
});
