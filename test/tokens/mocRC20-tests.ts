import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Address } from "hardhat-deploy/types";
import { MocTC } from "../../typechain";
import { BURNER_ROLE, DEFAULT_ADMIN_ROLE, MINTER_ROLE, PAUSER_ROLE, deployCollateralToken } from "../helpers/utils";

describe("Feature: Moc Tokens Role Access restrictions", () => {
  let token: MocTC;
  let deployer: Address, alice: Address, otherUser: Address;
  let aliceSigner: SignerWithAddress;
  describe("GIVEN there is a MocTC", () => {
    before(async () => {
      ({ alice, deployer, otherUser } = await getNamedAccounts());
      const fakeGovernor = deployer; // Governor is not relevant for this tests
      token = (await deployCollateralToken({ adminAddress: otherUser, governorAddress: fakeGovernor })).connect(
        await ethers.getSigner(deployer),
      );
      aliceSigner = await ethers.getSigner(alice);
    });
    describe("WHEN a BURNER Role address invokes mint", () => {
      it("THEN it fails with the corresponding error", async () => {
        await token.revokeRole(MINTER_ROLE, alice);
        await token.grantRole(BURNER_ROLE, alice);
        await expect(token.connect(aliceSigner).mint(alice, 10)).to.be.revertedWith(
          `AccessControl: account ${alice.toLowerCase()} is missing role ${MINTER_ROLE}`,
        );
      });
    });
    describe("WHEN a MINTER Role address invokes burn", () => {
      it("THEN it fails with the corresponding error", async () => {
        await token.revokeRole(BURNER_ROLE, alice);
        await token.grantRole(MINTER_ROLE, alice);
        await expect(token.connect(aliceSigner).burn(alice, 10)).to.be.revertedWith(
          `AccessControl: account ${aliceSigner.address.toLowerCase()} is missing role ${BURNER_ROLE}`,
        );
      });
    });
    describe("WHEN a MINTER Role address invokes pause", () => {
      it("THEN it fails with the corresponding error", async () => {
        await token.revokeRole(PAUSER_ROLE, alice);
        await token.grantRole(MINTER_ROLE, alice);
        await expect(token.connect(aliceSigner).pause()).to.be.revertedWith(
          `AccessControl: account ${aliceSigner.address.toLowerCase()} is missing role ${PAUSER_ROLE}`,
        );
      });
    });
    describe("WHEN none admin user invokes grantRole", () => {
      it("THEN it fails as it is not the roleAdmin", async () => {
        const otherUserSigner = await ethers.getSigner(otherUser);
        await expect(token.connect(otherUserSigner).grantRole(MINTER_ROLE, deployer)).to.be.revertedWith(
          `AccessControl: account ${otherUser.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`,
        );
      });
    });
  });
});
