import { ethers } from "hardhat";
import { expect } from "chai";
import { MocCARC20 } from "../../typechain";
import { pEth } from "../helpers/utils";
import { fixtureDeployedMocRC20 } from "./fixture";

describe.skip("Feature: MocRC20 rejects coinbase transfers", function () {
  let mocImpl: MocCARC20;

  describe("GIVEN a MocRC20 implementation deployed", function () {
    beforeEach(async function () {
      ({ mocImpl } = await fixtureDeployedMocRC20(0)());
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
