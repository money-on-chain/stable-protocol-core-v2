import { fixtureDeployedMocRC20 } from "./fixture";
import { ERC20Mock, MocCARC20 } from "../../typechain";
import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { mintTCBehavior } from "../behaviors/mintTC.behavior";
import { CONSTANTS } from "../helpers/utils";
import { expect } from "chai";
import { tpParams } from "../helpers/utils";
import { getNamedAccounts } from "hardhat";
import { Address } from "hardhat-deploy/types";

describe("Feature: MocCARC20 mint TC", function () {
  let mocImpl: MocCARC20;
  let collateralAsset: ERC20Mock;
  let mocFunctions: any;
  let alice: Address;

  describe("GIVEN a MocCARC20 implementation deployed", function () {
    beforeEach(async function () {
      ({ alice } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      mocFunctions = await mocFunctionsRC20(this.mocContracts);
      this.mocFunctions = mocFunctions;
      ({ mocImpl, collateralAsset } = this.mocContracts);
    });
    mintTCBehavior();

    describe("WHEN a user sends almost max uint256 amount of Asset to mint TC", function () {
      it("THEN tx reverts with panic code 0x11 overflow", async function () {
        const qACmax = CONSTANTS.MAX_BALANCE.mul(10);
        await collateralAsset.approve(mocImpl.address, qACmax);
        await expect(mocImpl.mintTC(CONSTANTS.MAX_BALANCE, qACmax)).to.be.revertedWithPanic("0x11");
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
          await expect(mocFunctions.mintTC({ from: alice, qTC: 100 })).to.be.revertedWith(
            "SafeERC20: ERC20 operation did not succeed",
          );
        });
      });
      describe("AND Collateral Asset transfer fails with revert", () => {
        beforeEach(async () => {
          await collateralAsset.forceTransferToFail(FailType.failWithRevert);
        });
        it("THEN tx reverts because transfer failed", async () => {
          await expect(mocFunctions.mintTC({ from: alice, qTC: 100 })).to.be.revertedWith(
            "SafeERC20: low-level call failed",
          );
        });
      });
    });
  });
});
