import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { MocTC } from "../../typechain";
import { MINTER_ROLE, BURNER_ROLE, PAUSER_ROLE, DEFAULT_ADMIN_ROLE } from "../helpers/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Address } from "hardhat-deploy/types";

describe("Feature: Moc Tokens Role Access restrictions", () => {
  let token: MocTC;
  let deployer: Address, alice: Address, roleAdmin: Address;
  let aliceSigner: SignerWithAddress;
  describe("GIVEN there is a MocTC", () => {
    before(async () => {
      const MocTCFactory = await ethers.getContractFactory("MocTC");
      ({ alice, deployer, otherUser: roleAdmin } = await getNamedAccounts());
      token = (await MocTCFactory.deploy("TestMocRC20", "TestMocRC20", roleAdmin)).connect(
        await ethers.getSigner(roleAdmin),
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
    describe("WHEN deployer address invokes grantRole", () => {
      it("THEN it fails as it is not the roleAdmin", async () => {
        const deployerSigner = await ethers.getSigner(deployer);
        await expect(token.connect(deployerSigner).grantRole(MINTER_ROLE, deployer)).to.be.revertedWith(
          `AccessControl: account ${deployer.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`,
        );
      });
    });
  });
});
