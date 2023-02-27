import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Address } from "hardhat-deploy/types";
import memoizee from "memoizee";
import { GovernorMock, GovernorMock__factory, MocVendors, MocVendors__factory } from "../../../typechain";
import { ERRORS } from "../../helpers/utils";

const fixtureDeploy = memoizee(
  (): (() => Promise<{
    mocVendors: MocVendors;
  }>) => {
    return deployments.createFixture(async ({ ethers }) => {
      await deployments.fixture();
      const signer = ethers.provider.getSigner();

      const deployedMocVendors = await deployments.getOrNull("MocVendorsCABagProxy");
      if (!deployedMocVendors) throw new Error("No MocVendors deployed.");
      const mocVendors: MocVendors = MocVendors__factory.connect(deployedMocVendors.address, signer);

      return {
        mocVendors,
      };
    });
  },
);

describe("Feature: Verify that all config settings are protected by governance", () => {
  let governorMock: GovernorMock;
  let mocVendors: MocVendors;
  let mockAddress: Address;

  before(async () => {
    ({ mocVendors } = await fixtureDeploy()());
    const governorAddress = await mocVendors.governor();
    governorMock = GovernorMock__factory.connect(governorAddress, ethers.provider.getSigner());
    mockAddress = governorAddress;
  });

  describe("GIVEN the Governor has authorized the change", () => {
    before(async () => {
      await governorMock.setIsAuthorized(true);
    });
    describe(`WHEN setVendorsGuardianAddress is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocVendors.setVendorsGuardianAddress(mockAddress);
        expect(await mocVendors.vendorsGuardianAddress()).to.be.equal(mockAddress);
      });
    });
  });
  describe("GIVEN the Governor has not authorized the change", () => {
    let expectRevertNotAuthorized: (it: any) => any;
    before(async () => {
      await governorMock.setIsAuthorized(false);

      expectRevertNotAuthorized = it => expect(it).to.be.revertedWithCustomError(mocVendors, ERRORS.NOT_AUTH_CHANGER);
    });
    describe("WHEN setVendorsGuardianAddress is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocVendors.setVendorsGuardianAddress(mockAddress));
      });
    });
  });
});
