import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { tcHoldersInterestPaymentBehavior } from "../behaviors/tcHoldersInterestPayment.behavior";
import { tpParams } from "../helpers/utils";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase TC holders interest payment", function () {
  describe("GIVEN a MocCoinbase implementation deployed", function () {
    before(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
    });
    tcHoldersInterestPaymentBehavior();
  });
});
