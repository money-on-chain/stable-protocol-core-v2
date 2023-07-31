import { Address } from "hardhat-deploy/types";
import { mocFunctionsRC20Deferred } from "../../helpers/mocFunctionsRC20Deferred";
import { mintTPBehavior } from "../../behaviors/mintTP.behavior";
import { tpParams } from "../../helpers/utils";
import { MocCARC20Deferred } from "../../../typechain";
import { assertPrec } from "../../helpers/assertHelper";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

let mocImpl: MocCARC20Deferred;
let mocFunctions: any;
let deployer: Address;

describe("Feature: MocCARC20Deferred mint TP", function () {
  describe("GIVEN a MocCARC20Deferred implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20Deferred(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20Deferred(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({ mocImpl } = this.mocContracts);
    });
    mintTPBehavior();

    describe("WHEN an user sends 100 AC to put a mint 10 TP operation in the queue", function () {
      beforeEach(async function () {
        // add collateral to be able to mint TP
        await mocFunctions.mintTC({ from: deployer, qTC: 100 });
        // Register a mintTP operation without executing it
        await mocFunctions.mintTP({ from: deployer, qTP: 10, execute: false });
      });
      it("THEN AC balance locked is 100 AC", async function () {
        assertPrec(await mocImpl.qACLockedInPending(), 100);
      });
    });
  });
});
