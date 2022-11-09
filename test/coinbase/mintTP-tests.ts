import { fixtureDeployedMocCoinbase } from "./fixture";
import { MocCACoinbase, NonPayableMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { mintTPBehavior } from "../behaviors/mintTP.behavior";
import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { ERRORS, pEth } from "../helpers/utils";
import { Address } from "hardhat-deploy/types";
import { tpParams } from "../helpers/utils";

describe("Feature: MocCoinbase mint TP", function () {
  let mocImpl: MocCACoinbase;
  let mocFunctions: any;
  let deployer: Address;

  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      ({ deployer } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({ mocImpl } = this.mocContracts);
    });
    mintTPBehavior();

    describe("WHEN a non payable contract tries to mintTP with exceeded amount of coinbase", () => {
      let nonPayable: NonPayableMock;
      beforeEach(async () => {
        //add collateral
        await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
        const factory = await ethers.getContractFactory("NonPayableMock");
        nonPayable = await factory.deploy();
      });
      it("THEN tx fails because contract cannot receive the surplus", async () => {
        const data = mocImpl.interface.encodeFunctionData("mintTP", [0, pEth(1)]);
        await expect(nonPayable.forward(mocImpl.address, data, { value: pEth(100) })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.TRANSFER_FAIL,
        );
      });
    });
  });
});
