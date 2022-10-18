import { fixtureDeployedMocCoinbase } from "./fixture";
import { MocCACoinbase, ReentrancyAttackerMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { swapTPforTPBehavior } from "../behaviors/swapTPforTP.behavior";
import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { ERRORS, pEth } from "../helpers/utils";
import { Address } from "hardhat-deploy/types";

import { tpParams } from "../helpers/utils";

describe("Feature: MocCoinbase swap TP for TP", function () {
  let mocImpl: MocCACoinbase;
  let mocFunctions: any;
  let deployer: Address;
  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      ({ deployer } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
      mocFunctions = this.mocFunctions;
      ({ mocImpl } = this.mocContracts);
    });
    swapTPforTPBehavior();

    describe("WHEN a reentracy attacker contract reentrant redeemTP", () => {
      let reentrancyAttacker: ReentrancyAttackerMock;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("ReentrancyAttackerMock");
        reentrancyAttacker = await factory.deploy();
        // add collateral
        await mocFunctions.mintTC({ from: deployer, qTC: 300 });
        // mint TP to reentracy attacker contract
        await mocFunctions.mintTPto({ i: 0, from: deployer, to: reentrancyAttacker.address, qTP: 100 });
      });
      it("THEN tx fails because there is a reentrant call", async () => {
        const data = mocImpl.interface.encodeFunctionData("swapTPforTP", [0, 1, pEth(1), 0]);
        await expect(reentrancyAttacker.forward(mocImpl.address, data, true, { value: pEth(100) })).to.be.revertedWith(
          ERRORS.REENTRACYGUARD,
        );
      });
    });
  });
});
