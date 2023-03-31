import { mocFunctionsCABag } from "../helpers/mocFunctionsCABag";
import { tcHoldersInterestPaymentBehavior } from "../behaviors/tcHoldersInterestPayment.behavior";
import { tpParams } from "../helpers/utils";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag TC holders interest payment", function () {
  describe("GIVEN a MocCABag implementation deployed", function () {
    before(async function () {
      const fixtureDeploy = fixtureDeployedMocCABag(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCABag(this.mocContracts);
    });
    tcHoldersInterestPaymentBehavior();
  });
});
