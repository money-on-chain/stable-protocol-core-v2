import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumberish, Contract } from "ethers";
import { Address } from "hardhat-deploy/types";
import { fixtureDeployGovernance } from "../upgradeability/coinbase/fixture";
import { IChangeContract__factory, MocCACoinbase, MocCore } from "../../../typechain";
import { ERRORS, deployPeggedToken, deployPriceProvider, pEth, CONSTANTS, tpParamsDefault } from "../../helpers/utils";

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
      tpMintFee = tpParamsDefault.mintFee,
      tpRedeemFee = tpParamsDefault.redeemFee,
      tpEma = tpParamsDefault.initialEma,
      tpEmaSf = tpParamsDefault.smoothingFactor,
    }: {
      tpTokenAddress?: Address;
      priceProviderAddress?: Address;
      tpCtarg?: BigNumberish;
      tpMintFee?: BigNumberish;
      tpRedeemFee?: BigNumberish;
      tpEma?: BigNumberish;
      tpEmaSf?: BigNumberish;
    } = {}) => {
      return changerFactory.deploy(mocProxy.address, {
        tpTokenAddress,
        priceProviderAddress,
        tpCtarg,
        tpMintFee,
        tpRedeemFee,
        tpEma,
        tpEmaSf,
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
            tpParamsDefault.mintFee,
            tpParamsDefault.redeemFee,
            tpParamsDefault.initialEma,
            tpParamsDefault.smoothingFactor,
          ]);
      });
    });
  });
});
