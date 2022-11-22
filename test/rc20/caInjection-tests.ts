import { ethers, getNamedAccounts } from "hardhat";
import { Address } from "hardhat-deploy/types";
import { mocFunctionsRC20 } from "../helpers/mocFunctionsRC20";
import { ERC20Mock, MocCARC20 } from "../../typechain";
import { assertPrec } from "../helpers/assertHelper";
import { pEth } from "../helpers/utils";
import { fixtureDeployedMocRC20 } from "./fixture";

describe("Feature: MocRC20 allows for collateral injection", function () {
  let mocImpl: MocCARC20;
  let collateralAsset: ERC20Mock;
  let alice: Address;
  describe("GIVEN a MocRC20 implementation deployed", function () {
    before(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(1);
      const mocContracts = await fixtureDeploy();
      const mocFunctions = await mocFunctionsRC20(mocContracts);
      ({ mocImpl, collateralAsset } = mocContracts);
      ({ alice } = await getNamedAccounts());
      await mocFunctions.mintTC({ from: alice, qTC: 10 });
    });
    describe("WHEN a user transfers CA tokens to the contract address", function () {
      before(async function () {
        await collateralAsset.connect(await ethers.getSigner(alice)).transfer(mocImpl.address, pEth(5));
      });
      it("THEN moc AC balance increases", async function () {
        await assertPrec(15, await collateralAsset.balanceOf(mocImpl.address));
      });
      it("THEN nothing changes on the model", async function () {
        await assertPrec(10, await mocImpl.nACcb());
        await assertPrec(1, await mocImpl.getPTCac());
      });
      describe("WHEN someone executes refreshACBalance", function () {
        before(async function () {
          await mocImpl.refreshACBalance();
        });
        it("THEN nACcb reflects the new balance", async function () {
          await assertPrec(15, await mocImpl.nACcb());
        });
        it("THEN TC ac price increases as there is more collateral", async function () {
          await assertPrec(1.5, await mocImpl.getPTCac());
        });
        describe("WHEN someone executes refreshACBalance again", function () {
          before(async function () {
            await mocImpl.refreshACBalance();
          });
          it("THEN nothing happens as the balance is already updated", async function () {
            await assertPrec(15, await mocImpl.nACcb());
            await assertPrec(1.5, await mocImpl.getPTCac());
          });
        });
      });
    });
  });
});
