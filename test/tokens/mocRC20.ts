import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { MocRC20 } from "../../typechain";
import { MINTER_ROLE, BURNER_ROLE } from "../../scripts/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Feature: MocRC20 Role Access restrictions", () => {
  let token: MocRC20;
  let otherUser: string;
  let otherSigner: SignerWithAddress;
  describe("GIVEN there is a MocRC20", () => {
    before(async () => {
      const MocRC20Factory = await ethers.getContractFactory("MocRC20");
      token = await MocRC20Factory.deploy("TestMocRC20", "TestMocRC20");
      ({ otherUser } = await getNamedAccounts());
      otherSigner = await ethers.getSigner(otherUser);
    });
    describe("WHEN a BURNER Role address invokes mint", () => {
      it("THEN it fails with the corresponding error", async () => {
        await token.revokeRole(MINTER_ROLE, otherUser);
        await token.grantRole(BURNER_ROLE, otherUser);
        await expect(token.connect(otherSigner).mint(otherUser, 10)).to.be.revertedWith(
          "MocRC20: must have minter role to mint",
        );
      });
    });
    describe("WHEN a MINTER Role address invokes burn", () => {
      it("THEN it fails with the corresponding error", async () => {
        await token.revokeRole(BURNER_ROLE, otherUser);
        await token.grantRole(MINTER_ROLE, otherUser);
        await expect(token.connect(otherSigner).burn(otherUser, 10)).to.be.revertedWith(
          "MocRC20: must have burner role to burn",
        );
      });
    });
  });
});
