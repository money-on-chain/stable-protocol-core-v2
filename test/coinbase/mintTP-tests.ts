import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { MocCACoinbase, MocRC20, NonPayableMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { mintTPBehavior } from "../behaviors/mintTP.behavior";
import { ERRORS, pEth, tpParams } from "../helpers/utils";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase mint TP", function () {
  let mocImpl: MocCACoinbase;
  let mocPeggedTokens: [MocRC20];
  let mocFunctions: any;
  let deployer: Address;

  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      ({ deployer } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsCoinbase(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({ mocImpl, mocPeggedTokens } = this.mocContracts);
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
        const tp = mocPeggedTokens[0].address;
        const data = mocImpl.interface.encodeFunctionData("mintTP", [tp, pEth(1)]);
        await expect(nonPayable.forward(mocImpl.address, data, { value: pEth(100) })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.TRANSFER_FAIL,
        );
      });
    });
  });
});
