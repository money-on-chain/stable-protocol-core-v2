import { fixtureDeployedMocCoinbase } from "./fixture";
import { MocCACoinbase, NonPayableMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { redeemTPBehavior } from "../behaviors/redeemTP.behavior";
import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { ERRORS, pEth } from "../helpers/utils";
import { Address } from "hardhat-deploy/types";
import { tpParams } from "../helpers/utils";

describe("Feature: MocCoinbase redeem TP", function () {
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
    redeemTPBehavior();

    describe("AND a non payable contract", () => {
      let nonPayable: NonPayableMock;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("NonPayableMock");
        nonPayable = await factory.deploy();
      });
      describe("WHEN it tries to redeemTP", () => {
        it("THEN tx fails because contract cannot receive the coinbase as Collateral Asset", async () => {
          // add collateral
          await mocFunctions.mintTC({ from: deployer, qTC: 300 });
          // mint TP to non payable contract
          await mocFunctions.mintTPto({ i: 0, from: deployer, to: nonPayable.address, qTP: 100 });
          const data = mocImpl.interface.encodeFunctionData("redeemTP", [0, pEth(1), 0]);
          await expect(nonPayable.forward(mocImpl.address, data)).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.TRANSFER_FAIL,
          );
        });
      });
      describe("WHEN a TP holder tries to redeemTP to it", () => {
        it("THEN tx fails because contract cannot receive the coinbase as Collateral Asset", async () => {
          // add collateral
          await mocFunctions.mintTC({ from: deployer, qTC: 300 });
          // mint TP to deployer
          await mocFunctions.mintTP({ i: 0, from: deployer, qTP: 100 });
          await expect(
            mocFunctions.redeemTPto({ i: 0, from: deployer, to: nonPayable.address, qTP: 100 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.TRANSFER_FAIL);
        });
      });
    });
  });
});
