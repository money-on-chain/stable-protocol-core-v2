import { getNamedAccounts, ethers } from "hardhat";
import { ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";
import { expect } from "chai";
import { pEth, tpParams } from "../helpers/utils";
import { MocVendors } from "../../typechain";
import { assertPrec } from "../helpers/assertHelper";
import { fixtureDeployedMocRC20 } from "../rc20/fixture";

let mocVendors: MocVendors;
let vendor: Address;
let vendorsGuardian: Address;
let tx: ContractTransaction;

describe("Feature: MocCARC20 vendors", function () {
  describe("GIVEN a MocCARC20 implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocRC20(tpParams.length, tpParams);
      ({ mocVendors } = await fixtureDeploy());
      ({ otherUser: vendorsGuardian, vendor } = await getNamedAccounts());

      await mocVendors.setVendorsGuardianAddress(vendorsGuardian);
    });
    describe("WHEN not vendor guardian tries to set a vendor markup", function () {
      it("THEN tx fails because only vendors guardian or vendor itself can", async function () {
        await expect(mocVendors.setVendorMarkup(vendor, pEth(1))).to.be.revertedWithCustomError(
          mocVendors,
          "NotVendorsGuardian",
        );
      });
    });
    describe("WHEN vendors guardian sets a vendor markup", function () {
      beforeEach(async function () {
        tx = await mocVendors.connect(await ethers.getSigner(vendorsGuardian)).setVendorMarkup(vendor, pEth(1));
      });
      it("THEN markup is set", async function () {
        assertPrec(await mocVendors.vendorMarkup(vendor), pEth(1));
      });
      it("THEN VendorMarkupChanged event is emitted", async function () {
        await expect(tx).to.emit(mocVendors, "VendorMarkupChanged").withArgs(vendor, pEth(1));
      });
    });
    describe("WHEN vendor sets itself a 10% markup", function () {
      beforeEach(async function () {
        tx = await mocVendors.connect(await ethers.getSigner(vendor)).setMarkup(pEth(0.1));
      });
      it("THEN VendorMarkupChanged event is emitted", async function () {
        await expect(tx).to.emit(mocVendors, "VendorMarkupChanged").withArgs(vendor, pEth(0.1));
      });
    });
  });
});
