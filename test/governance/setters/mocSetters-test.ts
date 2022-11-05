import { expect } from "chai";
import { ethers } from "hardhat";
import { fixtureDeployedMocCoinbase } from "../../coinbase/fixture";
import { GovernorMock, MocCACoinbase, GovernorMock__factory } from "../../../typechain";
import { ERRORS } from "../../helpers/utils";
import { Address } from "hardhat-deploy/types";

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
    describe(`WHEN tcMintFee is invoked`, () => {
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
  });
});
