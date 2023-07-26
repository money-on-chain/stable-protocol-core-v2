import { ethers } from "hardhat";
import { expect } from "chai";
import { MocCARC20Deferred } from "../../../typechain";
import { pEth } from "../../helpers/utils";
import { fixtureDeployedMocRC20Deferred } from "./fixture";

describe("Feature: MocCARC20Deferred rejects coinbase transfers", function () {
  let mocImpl: MocCARC20Deferred;

  describe("GIVEN a MocCARC20Deferred implementation deployed", function () {
    beforeEach(async function () {
      ({ mocImpl } = await fixtureDeployedMocRC20Deferred(0)());
    });
    describe("WHEN coinbase is sent to the contract", () => {
      it("THEN it fails", async () => {
        const [deployer] = await ethers.getSigners();
        await expect(
          deployer.sendTransaction({
            to: mocImpl.address,
            value: pEth(100),
          }),
        ).to.be.reverted;
      });
    });
  });
});
