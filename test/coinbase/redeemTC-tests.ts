import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { MocCACoinbase, NonPayableMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { redeemTCBehavior } from "../behaviors/redeemTC.behavior";
import { ERRORS, pEth, tpParams } from "../helpers/utils";
import { fixtureDeployedMocCoinbase } from "./fixture";

describe("Feature: MocCoinbase redeem TC", function () {
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
    redeemTCBehavior();
    describe("AND a non payable contract", () => {
      let nonPayable: NonPayableMock;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("NonPayableMock");
        nonPayable = await factory.deploy();
      });
      describe("WHEN it tries to redeemTC", () => {
        it("THEN tx fails because contract cannot receive the coinbase as Collateral Asset", async () => {
          // mint TC to non payable contract
          await mocFunctions.mintTC({ from: deployer, to: nonPayable.address, qTC: 1000 });
          const data = mocImpl.interface.encodeFunctionData("redeemTC", [pEth(1), 0]);
          await expect(nonPayable.forward(mocImpl.address, data)).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.TRANSFER_FAIL,
          );
        });
      });
      describe("WHEN a TC holder tries to redeemTC to it", () => {
        it("THEN tx fails because contract cannot receive the coinbase as Collateral Asset", async () => {
          // mint TC to deployer
          await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
          await expect(
            mocFunctions.redeemTC({ from: deployer, to: nonPayable.address, qTC: 1000 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.TRANSFER_FAIL);
        });
      });
    });
  });
});
