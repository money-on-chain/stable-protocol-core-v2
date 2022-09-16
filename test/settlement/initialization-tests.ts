import { fixtureDeployedMocCABag } from "../collateralBag/fixture";
import { MocCARC20, MocSettlement, MocSettlement__factory } from "../../typechain";
import { expect } from "chai";
import { ERRORS, CONSTANTS } from "../helpers/utils";
import { mocAddresses } from "../../deploy-config/config";
import { ethers } from "hardhat";
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
  describe("GIVEN a new MocSettlement instance", () => {
    let newMocImpl: MocSettlement;
    let newMocSettlementInit: any;
    before(async () => {
      const mocSettlementFactory = await ethers.getContractFactory("MocSettlement");
      const mocSettlementImpl = await mocSettlementFactory.deploy();

      const mocSettlementProxyFactory = await ethers.getContractFactory("ERC1967Proxy");
      const proxy = await mocSettlementProxyFactory.deploy(mocSettlementImpl.address, "0x");
      newMocImpl = MocSettlement__factory.connect(proxy.address, ethers.provider.getSigner());
      newMocSettlementInit = mocSettlementInitialize(newMocImpl, mocImpl.address);
    });
    describe("WHEN it is initialized with invalid governor address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(
          newMocSettlementInit({ mocGovernorAddress: CONSTANTS.ZERO_ADDRESS }),
        ).to.be.revertedWithCustomError(newMocImpl, ERRORS.INVALID_ADDRESS);
      });
    });
    describe("WHEN it is initialized with invalid stopper address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(newMocSettlementInit({ mocStopperAddress: CONSTANTS.ZERO_ADDRESS })).to.be.revertedWithCustomError(
          newMocImpl,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
    describe("WHEN it is initialized with invalid Collateral Asset address", () => {
      it("THEN tx fails because address is the zero address", async () => {
        await expect(newMocSettlementInit({ mocImplAddress: CONSTANTS.ZERO_ADDRESS })).to.be.revertedWithCustomError(
          newMocImpl,
          ERRORS.INVALID_ADDRESS,
        );
      });
    });
  });
});
