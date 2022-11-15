import { expect } from "chai";
import { ethers } from "hardhat";
import { Address } from "hardhat-deploy/types";
import { fixtureDeployedMocCoinbase } from "../../coinbase/fixture";
import { GovernorMock, GovernorMock__factory, MocCACoinbase } from "../../../typechain";
import { ERRORS } from "../../helpers/utils";

const fixtureDeploy = fixtureDeployedMocCoinbase(1);

describe("Feature: Verify that all config settings are protected by governance", () => {
  let mocProxy: MocCACoinbase;
  let governorMock: GovernorMock;
  let mockAddress: Address;

  before(async () => {
    ({ mocImpl: mocProxy } = await fixtureDeploy());
    const governorAddress = await mocProxy.governor();
    governorMock = GovernorMock__factory.connect(governorAddress, ethers.provider.getSigner());
    mockAddress = governorAddress;
  });

  describe("GIVEN the Governor has authorized the change", () => {
    before(async () => {
      await governorMock.setIsAuthorized(true);
    });
    // MocEma
    describe(`WHEN setEmaCalculationBlockSpan is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setEmaCalculationBlockSpan(42);
        expect(await mocProxy.emaCalculationBlockSpan()).to.be.equal(42);
      });
    });
    // MocBaseBucket
    describe(`WHEN setFeeRetainer is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setFeeRetainer(422);
        expect(await mocProxy.feeRetainer()).to.be.equal(422);
      });
    });
    describe(`WHEN setTcMintFee is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setTcMintFee(43);
        expect(await mocProxy.tcMintFee()).to.be.equal(43);
      });
    });
    describe(`WHEN setTcRedeemFee is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setTcRedeemFee(44);
        expect(await mocProxy.tcRedeemFee()).to.be.equal(44);
      });
    });
    describe(`WHEN setSwapTPforTPFee is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setSwapTPforTPFee(45);
        expect(await mocProxy.swapTPforTPFee()).to.be.equal(45);
      });
    });
    describe(`WHEN setRedeemTCandTPFee is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setRedeemTCandTPFee(46);
        expect(await mocProxy.redeemTCandTPFee()).to.be.equal(46);
      });
    });
    describe(`WHEN setSwapTPforTCFee is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setSwapTPforTCFee(47);
        expect(await mocProxy.swapTPforTCFee()).to.be.equal(47);
      });
    });
    describe(`WHEN setMocFeeFlowAddress is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setMocFeeFlowAddress(mockAddress);
        expect(await mocProxy.mocFeeFlowAddress()).to.be.equal(mockAddress);
      });
    });
    describe(`WHEN setMocInterestCollectorAddress is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setMocInterestCollectorAddress(mockAddress);
        expect(await mocProxy.mocInterestCollectorAddress()).to.be.equal(mockAddress);
      });
    });
    describe(`WHEN setMocAppreciationBeneficiaryAddress is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setMocAppreciationBeneficiaryAddress(mockAddress);
        expect(await mocProxy.mocAppreciationBeneficiaryAddress()).to.be.equal(mockAddress);
      });
    });
    describe(`WHEN setProtThrld is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setProtThrld(45);
        expect(await mocProxy.protThrld()).to.be.equal(45);
      });
    });
    describe(`WHEN setLiqThrld is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setLiqThrld(46);
        expect(await mocProxy.liqThrld()).to.be.equal(46);
      });
    });
    describe(`WHEN setSuccessFee is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setSuccessFee(47);
        expect(await mocProxy.successFee()).to.be.equal(47);
      });
    });
    describe(`WHEN setAppreciationFactor is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setAppreciationFactor(48);
        expect(await mocProxy.appreciationFactor()).to.be.equal(48);
      });
    });
  });
  describe("GIVEN the Governor has not authorized the change", () => {
    let expectRevertNotAuthorized: (it: any) => any;
    before(async () => {
      await governorMock.setIsAuthorized(false);

      expectRevertNotAuthorized = it => expect(it).to.be.revertedWithCustomError(mocProxy, ERRORS.NOT_AUTH_CHANGER);
    });
    describe("WHEN setEmaCalculationBlockSpan is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setEmaCalculationBlockSpan(42));
      });
    });
    describe("WHEN setTcMintFee is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setTcMintFee(42));
      });
    });
    describe("WHEN setTcRedeemFee is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setTcRedeemFee(42));
      });
    });
    describe("WHEN setSwapTPforTPFee is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setSwapTPforTPFee(42));
      });
    });
    describe("WHEN setRedeemTCandTPFee is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setRedeemTCandTPFee(42));
      });
    });
    describe("WHEN setSwapTPforTCFee is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setSwapTPforTCFee(42));
      });
    });
    describe("WHEN setMocFeeFlowAddress is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setMocFeeFlowAddress(mockAddress));
      });
    });
    describe("WHEN setMocInterestCollectorAddress is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setMocInterestCollectorAddress(mockAddress));
      });
    });
    describe("WHEN setMocAppreciationBeneficiaryAddress is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setMocAppreciationBeneficiaryAddress(mockAddress));
      });
    });
    describe("WHEN setProtThrld is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setProtThrld(42));
      });
    });
    describe("WHEN setLiqThrld is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setLiqThrld(42));
      });
    });
    describe("WHEN setSuccessFee is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setSuccessFee(42));
      });
    });
    describe("WHEN setAppreciationFactor is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setAppreciationFactor(42));
      });
    });
    describe("WHEN makeUnstoppable is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.makeUnstoppable());
      });
    });
    describe("WHEN makeStoppable is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.makeStoppable());
      });
    });
    describe("WHEN setPauser is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setPauser(mockAddress));
      });
    });
    describe("WHEN setLiqEnable is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setLiqEnabled(true));
      });
    });
  });
});
