import { expect } from "chai";
import { ethers } from "hardhat";
import { CONSTANTS, tpParamsDefault } from "../../helpers/utils";
import { fixtureDeployGovernance } from "../upgradability/coinbase/fixture";
import { IChangeContract__factory, MocCACoinbase, MocCore } from "../../../typechain";
import { deployPeggedToken, deployPriceProvider, ERRORS, pEth } from "../../helpers/utils";
import { BigNumberish, Contract } from "ethers";
import { Address } from "hardhat-deploy/types";

const fixtureDeploy = fixtureDeployGovernance();

export function deployChangerClosure(mocProxy: MocCore) {
  return async () => {
    const changerFactory = await ethers.getContractFactory("AddPeggedTokenChangerTemplate");
    const governorAddress = await mocProxy.governor();
    const mocPeggedToken = await deployPeggedToken({ adminAddress: mocProxy.address, governorAddress });
    const priceProvider = await deployPriceProvider(pEth(1));

    const deployAddChanger = ({
      tpTokenAddress = mocPeggedToken.address,
      priceProviderAddress = priceProvider.address,
      tpCtarg = tpParamsDefault.ctarg,
      tpR = tpParamsDefault.r,
      tpBmin = tpParamsDefault.bmin,
      tpMintFee = tpParamsDefault.mintFee,
      tpRedeemFee = tpParamsDefault.redeemFee,
      tpEma = tpParamsDefault.initialEma,
      tpEmaSf = tpParamsDefault.smoothingFactor,
      tpTils = tpParamsDefault.tils,
      tpTiMin = tpParamsDefault.tiMin,
      tpTiMax = tpParamsDefault.tiMax,
      tpAbeq = tpParamsDefault.abeq,
      tpFacMin = tpParamsDefault.facMin,
      tpFacMax = tpParamsDefault.facMax,
    }: {
      tpTokenAddress?: Address;
      priceProviderAddress?: Address;
      tpCtarg?: BigNumberish;
      tpR?: BigNumberish;
      tpBmin?: BigNumberish;
      tpMintFee?: BigNumberish;
      tpRedeemFee?: BigNumberish;
      tpEma?: BigNumberish;
      tpEmaSf?: BigNumberish;
      tpTils?: BigNumberish;
      tpTiMin?: BigNumberish;
      tpTiMax?: BigNumberish;
      tpAbeq?: BigNumberish;
      tpFacMin?: BigNumberish;
      tpFacMax?: BigNumberish;
    } = {}) => {
      return changerFactory.deploy(mocProxy.address, {
        tpTokenAddress,
        priceProviderAddress,
        tpCtarg,
        tpR,
        tpBmin,
        tpMintFee,
        tpRedeemFee,
        tpEma,
        tpEmaSf,
        tpTils,
        tpTiMin,
        tpTiMax,
        tpAbeq,
        tpFacMin,
        tpFacMax,
      });
    };
    return { mocPeggedToken, priceProvider, deployAddChanger };
  };
}

describe("Feature: Governance protected Pegged Token addition ", () => {
  let mocProxy: MocCACoinbase;
  let governor: Contract;
  let changeContract: Contract;
  let mocPeggedToken: Contract;
  let priceProvider: Contract;
  let deployChanger: any;

  before(async () => {
    ({ mocCACoinbase: mocProxy, governor } = await fixtureDeploy());

    ({ deployAddChanger: deployChanger, mocPeggedToken, priceProvider } = await deployChangerClosure(mocProxy)());
  });
  describe("WHEN trying to setup a Changer with invalid target coverage value", () => {
    it("THEN tx fails because target coverage is below ONE", async () => {
      await expect(deployChanger({ tpCtarg: CONSTANTS.ONE.sub(1) })).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_VALUE,
      );
    });
  });
  describe("WHEN trying to setup a Changer with invalid mint fee value", () => {
    it("THEN tx fails because mint fee is above ONE", async () => {
      await expect(deployChanger({ tpMintFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_VALUE,
      );
    });
  });
  describe("WHEN trying to setup a Changer with invalid redeem fee value", () => {
    it("THEN tx fails because redeem fee is above ONE", async () => {
      await expect(deployChanger({ tpRedeemFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_VALUE,
      );
    });
  });
  describe("WHEN trying to setup a Changer with invalid ema smoothing factor value", () => {
    it("THEN tx fails because ema smoothing factor is above ONE", async () => {
      await expect(deployChanger({ tpEmaSf: CONSTANTS.ONE })).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_VALUE,
      );
    });
  });
  describe("WHEN trying to setup a Changer with invalid initial interest rate value", () => {
    it("THEN tx fails because interest rate is above ONE", async () => {
      await expect(deployChanger({ tpTils: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_VALUE,
      );
    });
  });
  describe("WHEN trying to setup a Changer with invalid minimum interest rate value", () => {
    it("THEN tx fails because minimum interest rate is above ONE", async () => {
      await expect(deployChanger({ tpTiMin: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_VALUE,
      );
    });
  });
  describe("WHEN trying to setup a Changer with invalid maximum interest rate value", () => {
    it("THEN tx fails because maximum interest rate is above ONE", async () => {
      await expect(deployChanger({ tpTiMax: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_VALUE,
      );
    });
  });
  describe("WHEN trying to setup a Changer with invalid abundance value", () => {
    it("THEN tx fails because abundance is above ONE", async () => {
      await expect(deployChanger({ tpAbeq: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_VALUE,
      );
    });
  });
  describe("WHEN trying to setup a Changer with invalid minimum correction factor for interest rate value", () => {
    it("THEN tx fails because minimum correction factor for interest rate is above ONE", async () => {
      await expect(deployChanger({ tpFacMin: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_VALUE,
      );
    });
  });
  describe("WHEN trying to setup a Changer with invalid minimum correction factor for interest rate value", () => {
    it("THEN tx fails because minimum correction factor for interest rate is below ONE", async () => {
      await expect(deployChanger({ tpFacMax: CONSTANTS.ONE.sub(1) })).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_VALUE,
      );
    });
  });
  describe("GIVEN a Changer contract is set up to add a new Pegged Token", () => {
    before(async () => {
      changeContract = await deployChanger(); // with default params
    });
    describe("WHEN an unauthorized account executed the changer", () => {
      it("THEN it fails", async function () {
        const changerTemplate = IChangeContract__factory.connect(changeContract.address, ethers.provider.getSigner());
        await expect(changerTemplate.execute()).to.be.revertedWithCustomError(mocProxy, ERRORS.NOT_AUTH_CHANGER);
      });
    });
    describe("WHEN a the governor executes the changer contract", () => {
      it("THEN the new Pegged Token is added", async function () {
        await expect(governor.executeChange(changeContract.address))
          .to.emit(mocProxy, "PeggedTokenChange")
          .withArgs(0, [
            mocPeggedToken.address,
            priceProvider.address,
            tpParamsDefault.ctarg,
            tpParamsDefault.r,
            tpParamsDefault.bmin,
            tpParamsDefault.mintFee,
            tpParamsDefault.redeemFee,
            tpParamsDefault.initialEma,
            tpParamsDefault.smoothingFactor,
            tpParamsDefault.tils,
            tpParamsDefault.tiMin,
            tpParamsDefault.tiMax,
            tpParamsDefault.abeq,
            tpParamsDefault.facMin,
            tpParamsDefault.facMax,
          ]);
      });
    });
  });
});
