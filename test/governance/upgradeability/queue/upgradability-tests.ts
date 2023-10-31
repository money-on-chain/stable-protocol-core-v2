import { expect } from "chai";
import hre, { deployments, ethers, getNamedAccounts } from "hardhat";
import { Contract } from "ethers";
import { MocQueue, MocQueueMock, MocQueueMock__factory, MocQueue__factory } from "../../../../typechain";
import { deployAeropagusGovernor, ERRORS } from "../../../helpers/utils";
import { getNetworkDeployParams } from "../../../../scripts/utils";

describe("Feature: MocQueue Upgradeability UUPS", () => {
  let mocQueue: MocQueue;
  let mocQueueAsQueueMock: MocQueueMock;
  let mocQueueMockImpl: Contract;
  let governor: Contract;
  let changeContract: Contract;
  let wrongChangeContract: Contract;

  before(async () => {
    const { deployer } = await getNamedAccounts();
    await deployments.fixture();

    const signer = ethers.provider.getSigner();
    const deployedMocQueue = await deployments.getOrNull("MocQueueProxy");
    if (!deployedMocQueue) throw new Error("No MocQueue deployed.");
    mocQueue = MocQueue__factory.connect(deployedMocQueue.address, signer);

    // set a real governor
    governor = await deployAeropagusGovernor(deployer);
    await mocQueue.changeGovernor(governor.address);

    const MocQueueMockFactory = await ethers.getContractFactory("MocQueueMock");
    mocQueueMockImpl = await MocQueueMockFactory.deploy();

    const changerFactory = await ethers.getContractFactory("MocUpgradeChangerMock");
    changeContract = await changerFactory.deploy(mocQueue.address, mocQueueMockImpl.address);

    wrongChangeContract = await changerFactory.deploy(
      (
        await deployments.get("MocQueueProxy")
      ).implementation!,
      mocQueueMockImpl.address,
    );
  });

  describe("GIVEN a Changer contract is set up to upgrade MocQueue", () => {
    describe("WHEN update the contract calling the implementation", () => {
      it("THEN tx reverts because update only can be called by a proxy", async () => {
        await expect(governor.executeChange(wrongChangeContract.address)).to.be.revertedWith(
          "Function must be called through delegatecall",
        );
      });
    });
    describe("WHEN the governor didn't authorize the upgrade", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async () => {
        await expect(mocQueue.upgradeTo(mocQueueMockImpl.address)).to.be.revertedWithCustomError(
          mocQueue,
          ERRORS.NOT_AUTH_CHANGER,
        );
      });
    });
    describe("WHEN the owner updates the contract through governance", () => {
      before(async function () {
        await governor.executeChange(changeContract.address);
        mocQueueAsQueueMock = MocQueueMock__factory.connect(mocQueue.address, ethers.provider.getSigner());
      });
      it("THEN the new method and values are returned correctly", async function () {
        const newVariable = await mocQueueAsQueueMock.newVariable();
        expect(newVariable).to.be.equal(42);

        // This method returns the sum of and "old" state variable (protThrld) and the newVariable
        const newAndOldVariable = await mocQueueAsQueueMock.getCustomMockValue();
        const { tcMintExecFee } = getNetworkDeployParams(hre).queueParams.execFeeParams;
        expect(newAndOldVariable).to.be.equal(tcMintExecFee.add(42));
      });
    });
  });
});
