import { getNamedAccounts, ethers } from "hardhat";
import { Address } from "hardhat-deploy/types";
import { mocFunctionsCABag } from "../helpers/mocFunctionsCABag";
import { feeTokenBehavior } from "../behaviors/feeToken.behavior";
import { pEth, tpParams } from "../helpers/utils";
import { assertPrec } from "../helpers/assertHelper";
import { ERC20Mock, MocCARC20, MocCAWrapper } from "../../typechain";
import { fixtureDeployedMocCABag } from "./fixture";

let mocWrapper: MocCAWrapper;
let mocImpl: MocCARC20;
let feeToken: ERC20Mock;
let alice: Address;

describe("Feature: MocCABag Fee Token", function () {
  describe("GIVEN a MocCABag implementation deployed", function () {
    beforeEach(async function () {
      ({ alice } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCABag(tpParams.length, tpParams);
      this.mocContracts = await fixtureDeploy();
      this.mocFunctions = await mocFunctionsCABag(this.mocContracts);
      ({ mocWrapper, mocImpl, feeToken } = this.mocContracts);
    });
    feeTokenBehavior();
    describe("AND alice has 10 Fee Token and approve them to Moc Wrapper", function () {
      beforeEach(async function () {
        await feeToken.mint(alice, pEth(10));
        await feeToken.connect(await ethers.getSigner(alice)).approve(mocWrapper.address, pEth(10));
      });
      describe("WHEN Alice tries to mint more TC than what she can afford to pay fees for", function () {
        beforeEach(async function () {
          await this.mocFunctions.mintTC({ from: alice, qTC: 10000 });
        });
        it("THEN Moc Wrapper Fee Token allowance is reset to 0", async function () {
          assertPrec(await feeToken.balanceOf(alice), pEth(10));
          assertPrec(await feeToken.allowance(mocWrapper.address, mocImpl.address), 0);
        });
      });
      describe("WHEN Alice mints 40 TC, needing less fee Token that what she had approved", function () {
        beforeEach(async function () {
          await this.mocFunctions.mintTC({ from: alice, qTC: 40 });
        });
        it("THEN Moc Wrapper Fee Token allowance is reset to 0", async function () {
          assertPrec(await feeToken.balanceOf(alice), pEth(9));
          assertPrec(await feeToken.allowance(mocWrapper.address, mocImpl.address), 0);
        });
      });
      describe("WHEN Alice mints 400 TC, all her fee Token is used", function () {
        beforeEach(async function () {
          await this.mocFunctions.mintTC({ from: alice, qTC: 400 });
        });
        it("THEN Moc Wrapper Fee Token allowance is reset to 0", async function () {
          assertPrec(await feeToken.balanceOf(alice), 0);
          assertPrec(await feeToken.allowance(mocWrapper.address, mocImpl.address), 0);
        });
      });
    });
  });
});
