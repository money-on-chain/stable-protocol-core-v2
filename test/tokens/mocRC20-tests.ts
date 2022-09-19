import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { MocTC } from "../../typechain";
import { MINTER_ROLE, BURNER_ROLE, PAUSER_ROLE } from "../helpers/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Feature: Moc Tokens Role Access restrictions", () => {
  let token: MocTC;
  let deployer, otherUser: string;
  let otherSigner: SignerWithAddress;
  describe("GIVEN there is a MocTC", () => {
    before(async () => {
      const MocTCFactory = await ethers.getContractFactory("MocTC");
      ({ otherUser, deployer } = await getNamedAccounts());
      token = await MocTCFactory.deploy("TestMocRC20", "TestMocRC20", deployer);
      otherSigner = await ethers.getSigner(otherUser);
    });
    describe("WHEN a BURNER Role address invokes mint", () => {
      it("THEN it fails with the corresponding error", async () => {
        await token.revokeRole(MINTER_ROLE, otherUser);
        await token.grantRole(BURNER_ROLE, otherUser);
        await expect(token.connect(otherSigner).mint(otherUser, 10)).to.be.revertedWith(
          `AccessControl: account ${otherSigner.address.toLowerCase()} is missing role ${MINTER_ROLE}`,
        );
      });
    });
    describe("WHEN a MINTER Role address invokes burn", () => {
      it("THEN it fails with the corresponding error", async () => {
        await token.revokeRole(BURNER_ROLE, otherUser);
        await token.grantRole(MINTER_ROLE, otherUser);
        await expect(token.connect(otherSigner).burn(otherUser, 10)).to.be.revertedWith(
          `AccessControl: account ${otherSigner.address.toLowerCase()} is missing role ${BURNER_ROLE}`,
        );
      });
    });
    describe("WHEN a MINTER Role address invokes pause", () => {
      it("THEN it fails with the corresponding error", async () => {
        await token.revokeRole(PAUSER_ROLE, otherUser);
        await token.grantRole(MINTER_ROLE, otherUser);
        await expect(token.connect(otherSigner).pause()).to.be.revertedWith(
          `AccessControl: account ${otherSigner.address.toLowerCase()} is missing role ${PAUSER_ROLE}`,
        );
      });
    });
  });
});
