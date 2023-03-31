import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { tcHoldersInterestPaymentBehavior } from "../behaviors/tcHoldersInterestPayment.behavior";
import { tpParams } from "../helpers/utils";
import { fixtureDeployedMocRC20 } from "./fixture";

describe("Feature: MocCARC20 TC holders interest payment", function () {
  describe("GIVEN a MocCARC20 implementation deployed", function () {
    before(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    tcHoldersInterestPaymentBehavior();
  });
});
