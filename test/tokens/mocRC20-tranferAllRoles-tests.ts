import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Address } from "hardhat-deploy/types";
import { MocTC } from "../../typechain";
import {
  BURNER_ROLE,
  DEFAULT_ADMIN_ROLE,
  MINTER_ROLE,
  PAUSER_ROLE,
  deployCollateralToken,
  ERRORS,
} from "../helpers/utils";

describe("Feature: Moc Tokens roles can be transferred by transferAllRoles", () => {
  let token: MocTC;
  let deployer: Address, alice: Address, roleAdmin: Address;
  let aliceSigner: SignerWithAddress;
  describe("GIVEN deployer (admin) account gives Alice other roles roles", () => {
    before(async () => {
      ({ alice, deployer, otherUser: roleAdmin } = await getNamedAccounts());
      const fakeGovernor = deployer; // Governor is not relevant for this tests
      token = await deployCollateralToken({ adminAddress: deployer, governorAddress: fakeGovernor });
      await Promise.all([BURNER_ROLE, MINTER_ROLE, PAUSER_ROLE].map(role => token.grantRole(role, alice)));
      aliceSigner = await ethers.getSigner(alice);
      // verify she can mint/burn
      await token.connect(aliceSigner).mint(alice, 10);
      await token.connect(aliceSigner).burn(alice, 10);
    });
    describe("WHEN he tries to grantsAllRoles to roleAdmin", () => {
      it("THEN it fails as Alice cannot keep her roles", async () => {
        await expect(token.transferAllRoles(roleAdmin)).to.be.revertedWithCustomError(token, ERRORS.NOT_UNIQUE_ROLE);
      });
    });
    describe("WHEN he grantsAllRoles to roleAdmin account, after revoking every Alice's Roles", () => {
      before(async () => {
        await Promise.all([BURNER_ROLE, MINTER_ROLE, PAUSER_ROLE].map(role => token.revokeRole(role, alice)));
        await token.transferAllRoles(roleAdmin);
      });
      it("THEN she cannot mint any more", async () => {
        await expect(token.connect(aliceSigner).mint(alice, 10)).to.be.revertedWith(
          `AccessControl: account ${alice.toLowerCase()} is missing role ${MINTER_ROLE}`,
        );
      });
      it("THEN she cannot burn any more", async () => {
        await expect(token.connect(aliceSigner).burn(alice, 10)).to.be.revertedWith(
          `AccessControl: account ${alice.toLowerCase()} is missing role ${BURNER_ROLE}`,
        );
      });
      it("THEN she cannot pause any more", async () => {
        await expect(token.connect(aliceSigner).pause()).to.be.revertedWith(
          `AccessControl: account ${alice.toLowerCase()} is missing role ${PAUSER_ROLE}`,
        );
      });
      it("THEN he no longer has Admin role", async () => {
        await expect(token.grantRole(MINTER_ROLE, alice)).to.be.revertedWith(
          `AccessControl: account ${deployer.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`,
        );
      });
      it("THEN roleAdmin account has all roles", async () => {
        expect(
          await Promise.all(
            [DEFAULT_ADMIN_ROLE, BURNER_ROLE, MINTER_ROLE, PAUSER_ROLE].map(role => token.hasRole(role, roleAdmin)),
          ).then(allHasRole => allHasRole.reduce((accum, hasRole) => accum && hasRole, true)),
        ).to.be.true;
      });
    });
  });
});
