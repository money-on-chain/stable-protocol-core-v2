import { fixtureDeployedMocCoinbase } from "./fixture";
import { MocCACoinbase, MocRC20, NonPayable } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { mintTCBehavior } from "../behaviors/mintTC.behavior";
import { ethers } from "hardhat";
import { expect } from "chai";
import { pEth } from "../helpers/utils";

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

    describe("WHEN a non payable contract 100 mintTC with excedeed amount of rbtc", () => {
      let nonPayable: NonPayable;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("NonPayable");
        nonPayable = await factory.deploy({ value: pEth(100) });
      });
      it("THEN tx fails because contract cannot receive the surplus", async () => {
        const data = mocCore.interface.encodeFunctionData("mintTC", [pEth(1)]);
        await nonPayable.forward(mocCore.address, data, { value: pEth(100) });
        expect(await mocCollateralToken.balanceOf(nonPayable.address)).to.be.equal(0);
      });
    });
  });
});
