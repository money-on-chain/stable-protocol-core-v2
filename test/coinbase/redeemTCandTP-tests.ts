import { fixtureDeployedMocCoinbase } from "./fixture";
import { MocCACoinbase, NonPayableMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { redeemTCandTPBehavior } from "../behaviors/redeemTCandTP.behavior";
import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { ERRORS, pEth } from "../helpers/utils";
import { Address } from "hardhat-deploy/types";
import { tpParams } from "../helpers/utils";

describe("Feature: MocCoinbase redeem TC and TP", function () {
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
    redeemTCandTPBehavior();

    describe("AND a non payable contract", () => {
      let nonPayable: NonPayableMock;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("NonPayableMock");
        nonPayable = await factory.deploy();
      });
      describe("WHEN it tries to redeem TC and TP", () => {
        it("THEN tx fails because contract cannot receive the coinbase as Collateral Asset", async () => {
          // add collateral
          await mocFunctions.mintTCto({ from: deployer, to: nonPayable.address, qTC: 300 });
          // mint TP to non payable contract
          await mocFunctions.mintTPto({ i: 0, from: deployer, to: nonPayable.address, qTP: 100 });
          const data = mocImpl.interface.encodeFunctionData("redeemTCandTP", [0, pEth(1), pEth(100), 0]);
          await expect(nonPayable.forward(mocImpl.address, data)).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.TRANSFER_FAIL,
          );
        });
      });
      describe("WHEN a TP holder tries to redeem TC and TP to it", () => {
        it("THEN tx fails because contract cannot receive the coinbase as Collateral Asset", async () => {
          // add collateral
          await mocFunctions.mintTC({ from: deployer, qTC: 300 });
          // mint TP to deployer
          await mocFunctions.mintTP({ i: 0, from: deployer, qTP: 100 });
          await expect(
            mocFunctions.redeemTCandTPto({ i: 0, from: deployer, to: nonPayable.address, qTC: 1, qTP: 100 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.TRANSFER_FAIL);
        });
      });
    });
  });
});
