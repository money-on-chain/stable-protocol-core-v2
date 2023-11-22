import hre, { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { GovernorMock, MocQueue } from "../../typechain";
import { DEFAULT_ADMIN_ROLE, ERRORS, MINTER_ROLE } from "../helpers/utils";
import { getNetworkDeployParams } from "../../scripts/utils";

describe("Feature: Moc Queue Role Access restrictions", () => {
  let mocQueue: MocQueue;
  let governorMock: GovernorMock;
  let otherUser: Address;
  let signer: any;
  describe("GIVEN there is a MocQueue", () => {
    before(async () => {
      ({ otherUser } = await getNamedAccounts());
      signer = await ethers.getSigner(otherUser);
      const governorMockFactory = await ethers.getContractFactory("GovernorMock");
      const mocQueueFactory = await ethers.getContractFactory("MocQueue");
      governorMock = await governorMockFactory.deploy();
      mocQueue = await mocQueueFactory.deploy();
      const {
        queueParams: { minOperWaitingBlk, maxOperPerBatch, execFeeParams },
      } = getNetworkDeployParams(hre);
      await mocQueue.initialize(
        governorMock.address, // governor
        governorMock.address, // pauser
        minOperWaitingBlk,
        maxOperPerBatch,
        execFeeParams,
      );
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
        describe("WHEN he adds more roles without governance", async () => {
          before(async () => {
            await governorMock.setIsAuthorized(false);
          });
          it("THEN he can as he is now Admin", async () => {
            await mocQueue.connect(signer).grantRole(MINTER_ROLE, otherUser);
            expect(await mocQueue.hasRole(MINTER_ROLE, otherUser)).to.be.true;
          });
        });
      });
    });
  });
});
