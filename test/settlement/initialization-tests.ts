import { fixtureDeployedMocCABag } from "../collateralBag/fixture";
import { MocCARC20, MocSettlement } from "../../typechain";
import { expect } from "chai";
import { ERRORS } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";
import { BigNumberish } from "ethers";
import { Address } from "hardhat-deploy/types";

const { governorAddress, stopperAddress } = mocAddresses["hardhat"];

function mocSettlementInitialize(mocSettlement: MocSettlement, mocImpl: Address) {
  return ({
    mocGovernorAddress = governorAddress,
    mocStopperAddress = stopperAddress,
    mocImplAddress = mocImpl,
    bes = 0,
    bmulcdj = 0,
  }: {
    mocGovernorAddress?: Address;
    mocStopperAddress?: Address;
    mocImplAddress?: Address;
    bes?: BigNumberish;
    bmulcdj?: BigNumberish;
  } = {}) => {
    return mocSettlement.initialize(mocGovernorAddress, mocStopperAddress, mocImplAddress, bes, bmulcdj);
  };
}

describe("Feature: MocSettlement initialization", function () {
  let mocImpl: MocCARC20;
  let mocSettlement: MocSettlement;
  let mocSettlementInit: any;

  before(async () => {
    ({ mocImpl, mocSettlement } = await fixtureDeployedMocCABag(0)());
    mocSettlementInit = mocSettlementInitialize(mocSettlement, mocImpl.address);
  });
  describe("GIVEN a MocSettlement implementation deployed", () => {
    describe("WHEN initialize mocSettlementProxy again", async () => {
      it("THEN tx fails because contract is already initialized", async () => {
        await expect(mocSettlementInit()).to.be.revertedWith(ERRORS.CONTRACT_INITIALIZED);
      });
    });
  });
});
