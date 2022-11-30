import { ethers } from "hardhat";
import { expect } from "chai";
import { MocCARC20, MocCAWrapper } from "../../typechain";
import { pEth } from "../helpers/utils";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCABag rejects coinbase transfers", function () {
  let mocImpl: MocCARC20;
  let mocWrapper: MocCAWrapper;

  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      ({ mocImpl, mocWrapper } = await fixtureDeployedMocCABag(0)());
    });
    describe("WHEN coinbase is sent to moc contract", () => {
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
    describe("WHEN coinbase is sent to wrapper contract", () => {
      it("THEN it fails", async () => {
        const [deployer] = await ethers.getSigners();
        await expect(
          deployer.sendTransaction({
            to: mocWrapper.address,
            value: pEth(100),
          }),
        ).to.be.reverted;
      });
    });
  });
});
