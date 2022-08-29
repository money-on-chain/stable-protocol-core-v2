import { fixtureDeployedMocCoinbase } from "./fixture";
import { MocCACoinbase, MocRC20, NonPayable, ReentrancyAttacker } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { mintTCBehavior } from "../behaviors/mintTC.behavior";
import { ethers } from "hardhat";
import { expect } from "chai";
import { ERRORS, pEth } from "../helpers/utils";

describe("Feature: MocCoinbase mint TC", function () {
  let mocCore: MocCACoinbase;
  let mocCollateralToken: MocRC20;

  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(0);
      ({ mocCore, mocCollateralToken } = await fixtureDeploy());
      this.mocFunctions = await mocFunctionsCoinbase({ mocCore, mocCollateralToken });
      this.mocContracts = { mocCore, mocCollateralToken };
    });
    mintTCBehavior();

    describe("WHEN a non payable contract tries to mintTC with exceeded amount of coinbase", () => {
      let nonPayable: NonPayable;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("NonPayable");
        nonPayable = await factory.deploy();
      });
      it("THEN tx fails because contract cannot receive the surplus", async () => {
        const data = mocCore.interface.encodeFunctionData("mintTC", [pEth(1)]);
        await expect(nonPayable.forward(mocCore.address, data, { value: pEth(100) })).to.be.revertedWithCustomError(
          mocCore,
          ERRORS.TRANSFER_FAIL,
        );
      });
    });

    describe("WHEN a reentracy attacker contract reentrant mintTC", () => {
      let reentrancyAttacker: ReentrancyAttacker;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("ReentrancyAttacker");
        reentrancyAttacker = await factory.deploy();
      });
      it("THEN tx fails because contract cannot receive the surplus", async () => {
        const data = mocCore.interface.encodeFunctionData("mintTC", [pEth(1)]);
        await expect(reentrancyAttacker.forward(mocCore.address, data, { value: pEth(100) })).to.be.revertedWith(
          ERRORS.REENTRACYGUARD,
        );
      });
    });
  });
});
