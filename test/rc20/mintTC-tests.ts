import { expect } from "chai";
import { getNamedAccounts } from "hardhat";
import { Address } from "hardhat-deploy/types";
import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { mintTCBehavior } from "../behaviors/mintTC.behavior";
import { mintTCQueueBehavior } from "../behaviors/queue/mintTCQueue.behavior";
import { CONSTANTS, tpParams } from "../helpers/utils";
import { ERC20Mock } from "../../typechain";
import { fixtureDeployedMocRC20 } from "./fixture";

describe("Feature: MocCARC20 mint TC", function () {
  let mocFunctions: any;
  let collateralAsset: ERC20Mock;
  let deployer: Address;

  describe("GIVEN a MocCARC20 implementation deployed with mocQueueMock", function () {
    beforeEach(async function () {
      ({ deployer } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams, true);
      this.mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({ collateralAsset } = this.mocContracts);
    });

    mintTCBehavior();

    describe("WHEN an user sends almost max uint256 amount of Asset to mint TC", function () {
      it("THEN tx reverts with panic code 0x11 overflow", async function () {
        const qACmax = CONSTANTS.MAX_BALANCE;
        const qTC = CONSTANTS.MAX_BALANCE;
        await expect(
          mocFunctions.mintTC({ from: deployer, qTC, qACmax, applyPrecision: false }),
        ).to.be.revertedWithPanic("0x11");
      });
    });
    describe("WHEN alice tries to mint 10 TC", () => {
      enum FailType {
        notFail,
        failWithFalse,
        failWithRevert,
      }

      describe("AND Collateral Asset transfer fails with false", () => {
        beforeEach(async () => {
          await collateralAsset.forceTransferToFail(FailType.failWithFalse);
        });
        it("THEN tx reverts because transfer failed", async () => {
          await expect(mocFunctions.mintTC({ from: deployer, qTC: 100 })).to.be.revertedWith(
            "SafeERC20: ERC20 operation did not succeed",
          );
        });
      });
      describe("AND Collateral Asset transfer fails with revert", () => {
        beforeEach(async () => {
          await collateralAsset.forceTransferToFail(FailType.failWithRevert);
        });
        it("THEN tx reverts because transfer failed", async () => {
          await expect(mocFunctions.mintTC({ from: deployer, qTC: 100 })).to.be.revertedWith(
            "SafeERC20: low-level call failed",
          );
        });
      });
    });
  });
  describe("GIVEN a MocCARC20 implementation deployed behind MocQueue", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams, false);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsRC20(this.mocContracts);
    });
    mintTCQueueBehavior();
  });
});
