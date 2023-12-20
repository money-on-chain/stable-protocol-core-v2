import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { GovernorMock, GovernorMock__factory, MocQueue } from "../../typechain";
import { DEFAULT_ADMIN_ROLE, ERRORS, MINTER_ROLE } from "../helpers/utils";
import { fixtureDeployedMocRC20 } from "../rc20/fixture";

describe("Feature: Moc Queue Role Access restrictions", () => {
  let mocQueue: MocQueue;
  let governorMock: GovernorMock;
  let otherUser: Address;
  let signer: any;
  describe("GIVEN there is a MocQueue", () => {
    before(async () => {
      ({ otherUser } = await getNamedAccounts());
      ({ mocQueue } = await fixtureDeployedMocRC20(0, undefined, false)());
      signer = await ethers.getSigner(otherUser);
      governorMock = GovernorMock__factory.connect(await mocQueue.governor(), ethers.provider.getSigner());
    });
    describe("WHEN a none ADMIN nor authorized account invokes grantRole ADMIN", () => {
      it("THEN it fails as it is not the roleAdmin", async () => {
        await governorMock.setIsAuthorized(false);
        await expect(mocQueue.connect(signer).grantRole(DEFAULT_ADMIN_ROLE, otherUser)).to.be.revertedWithCustomError(
          mocQueue,
          ERRORS.NOT_AUTH_CHANGER,
        );
      });
      describe("WHEN its authorized via governance AND grants himself ADMIN Role", () => {
        before(async () => {
          await governorMock.setIsAuthorized(true);
          await mocQueue.connect(signer).grantRole(DEFAULT_ADMIN_ROLE, otherUser);
        });
        it("THEN he has the ADMIN role", async () => {
          expect(await mocQueue.hasRole(DEFAULT_ADMIN_ROLE, otherUser)).to.be.true;
        });
        describe("WHEN he is not longer authorized by governance", async () => {
          beforeEach(async () => {
            await governorMock.setIsAuthorized(false);
            await mocQueue.connect(signer).grantRole(MINTER_ROLE, otherUser);
          });
          it("THEN he can still grant Roles, as he is now Admin", async () => {
            expect(await mocQueue.hasRole(MINTER_ROLE, otherUser)).to.be.true;
          });
          it("THEN he can revoke granted Roles, as he is now Admin", async () => {
            await mocQueue.connect(signer).revokeRole(MINTER_ROLE, otherUser);
            expect(await mocQueue.hasRole(MINTER_ROLE, otherUser)).to.be.false;
          });
        });
      });
    });
  });
});
