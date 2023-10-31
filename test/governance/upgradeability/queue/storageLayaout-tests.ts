import { ethers, upgrades, deployments } from "hardhat";
import { MocQueue, MocQueue__factory } from "../../../../typechain";

describe("Feature: Check MocQueue storage layout compatibility using openzeppelin hardhat upgrade ", () => {
  let mocQueue: MocQueue;
  let mocQueueFactory: any;
  let mocQueueMockFactory: any;
  describe("GIVEN a Moc Proxy is deployed", () => {
    before(async () => {
      await deployments.fixture();
      const signer = ethers.provider.getSigner();
      const deployedMocQueue = await deployments.getOrNull("MocQueueProxy");
      if (!deployedMocQueue) throw new Error("No MocQueue deployed.");
      mocQueue = MocQueue__factory.connect(deployedMocQueue.address, signer);
      mocQueueFactory = await ethers.getContractFactory("MocQueue");
      mocQueueMockFactory = await ethers.getContractFactory("MocQueueMock");
    });
    describe("WHEN it is upgraded to a new implementation", () => {
      it("THEN it succeeds as it is consistent with the previous storage", async () => {
        // forces the import of an existing proxy to be used with this plugin
        await upgrades.forceImport(mocQueue.address, mocQueueFactory);
        await upgrades.upgradeProxy(mocQueue.address, mocQueueMockFactory, {
          unsafeAllow: ["delegatecall"],
        });
      });
    });
    describe("WHEN check storage layout compatibility between MocQueue and MocQueueMock", () => {
      it("THEN it succeeds as there is not storage collision", async () => {
        await upgrades.validateUpgrade(mocQueueFactory, mocQueueMockFactory, {
          unsafeAllow: ["delegatecall"],
        });
      });
    });
  });
});
