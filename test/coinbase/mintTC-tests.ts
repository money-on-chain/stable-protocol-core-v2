import { ethers } from "hardhat";
import { expect } from "chai";
import { MocCACoinbase, NonPayableMock } from "../../typechain";
import { mocFunctionsCoinbaseDeferred } from "../helpers/mocFunctionsCoinbaseDeferred";
import { mintTCBehavior } from "../behaviors/mintTC.behavior";
import { ERRORS, pEth, tpParams } from "../helpers/utils";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase mint TC", function () {
  let mocImpl: MocCACoinbase;

  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCoinbaseDeferred(this.mocContracts);
      ({ mocImpl } = this.mocContracts);
    });
    mintTCBehavior();

    describe.skip("WHEN a non payable contract tries to mintTC with exceeded amount of coinbase", () => {
      let nonPayable: NonPayableMock;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("NonPayableMock");
        nonPayable = await factory.deploy();
      });
      it("THEN tx fails because contract cannot receive the surplus", async () => {
        const data = mocImpl.interface.encodeFunctionData("mintTC", [pEth(1)]);
        await expect(nonPayable.forward(mocImpl.address, data, { value: pEth(100) })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.TRANSFER_FAIL,
        );
      });
    });
  });
});
