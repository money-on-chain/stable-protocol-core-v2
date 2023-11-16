import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import memoizee from "memoizee";
import { GovernorMock, GovernorMock__factory, MocQueue } from "../../../typechain";
import { ERRORS } from "../../helpers/utils";
import { deployMocQueue } from "../../../scripts/utils";

const fixtureDeploy = memoizee(
  (): (() => Promise<{
    mocQueue: MocQueue;
    governorMock: GovernorMock;
  }>) => {
    return deployments.createFixture(async () => {
      await deployments.fixture();
      const mocQueue = await deployMocQueue(hre, "MocQueue");
      const governorAddress = await mocQueue.governor();
      return {
        mocQueue,
        governorMock: GovernorMock__factory.connect(governorAddress, ethers.provider.getSigner()),
      };
    });
  },
);

describe("Feature: Verify all MocQueue config settings are protected by governance", () => {
  let governorMock: GovernorMock;
  let mocQueue: MocQueue;

  before(async () => {
    ({ mocQueue, governorMock } = await fixtureDeploy()());
  });

  describe("GIVEN the Governor has authorized the change", () => {
    before(async () => {
      await governorMock.setIsAuthorized(true);
    });
    describe(`WHEN setMinOperWaitingBlk is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocQueue.setMinOperWaitingBlk(100);
        expect(await mocQueue.minOperWaitingBlk()).to.be.equal(100);
      });
    });
    describe(`WHEN setMaxOperPerBatch is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocQueue.setMaxOperPerBatch(20);
        expect(await mocQueue.maxOperPerBatch()).to.be.equal(20);
      });
    });
    describe(`WHEN register bucket is invoked`, () => {
      before(async () => {
        await mocQueue.registerBucket(governorMock.address);
      });
      it("THEN the new value is assigned", async function () {
        expect(await mocQueue.mocCore()).to.be.equal(governorMock.address);
      });
      describe(`AND register bucket is invoked again`, () => {
        it("THEN it fails with bucket already registered error", async function () {
          const tx = mocQueue.registerBucket(governorMock.address);
          await expect(tx).to.be.revertedWithCustomError(mocQueue, ERRORS.BUCKET_ALREADY_REGISTERED);
        });
      });
    });
  });
  describe("GIVEN the Governor has not authorized the change", () => {
    let expectRevertNotAuthorized: (it: any) => any;
    before(async () => {
      await governorMock.setIsAuthorized(false);
      expectRevertNotAuthorized = it => expect(it).to.be.revertedWithCustomError(mocQueue, ERRORS.NOT_AUTH_CHANGER);
    });
    describe("WHEN minOperWaitingBlk is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocQueue.setMinOperWaitingBlk(42));
      });
    });
    describe("WHEN setMaxOperPerBatch is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocQueue.setMaxOperPerBatch(42));
      });
    });
    describe("WHEN registerBucket is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocQueue.registerBucket(governorMock.address));
      });
    });
  });
});
