import { expect } from "chai";
import { ethers } from "hardhat";
import { Address } from "hardhat-deploy/types";
import { fixtureDeployedMocCoinbase } from "../../coinbase/fixture";
import { GovernorMock, GovernorMock__factory, MocCACoinbase } from "../../../typechain";
import { ERRORS } from "../../helpers/utils";

const fixtureDeploy = fixtureDeployedMocCoinbase(1);

describe("Feature: Verify all MocCore config settings are protected by governance", () => {
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
    // MocSettlement
    describe(`WHEN setBes is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setBes(421);
        expect(await mocProxy.bes()).to.be.equal(421);
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
    describe(`WHEN setMintTCandTPFee is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setMintTCandTPFee(47);
        expect(await mocProxy.mintTCandTPFee()).to.be.equal(47);
      });
    });
    describe(`WHEN setSwapTPforTCFee is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setSwapTPforTCFee(48);
        expect(await mocProxy.swapTPforTCFee()).to.be.equal(48);
      });
    });
    describe(`WHEN setSwapTCforTPFee is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setSwapTCforTPFee(49);
        expect(await mocProxy.swapTCforTPFee()).to.be.equal(49);
      });
    });
    describe(`WHEN setMocFeeFlowAddress is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setMocFeeFlowAddress(mockAddress);
        expect(await mocProxy.mocFeeFlowAddress()).to.be.equal(mockAddress);
      });
    });
    describe(`WHEN setMocAppreciationBeneficiaryAddress is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setMocAppreciationBeneficiaryAddress(mockAddress);
        expect(await mocProxy.mocAppreciationBeneficiaryAddress()).to.be.equal(mockAddress);
      });
    });
    describe(`WHEN setFeeTokenAddress is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setFeeTokenAddress(mockAddress);
        expect(await mocProxy.feeToken()).to.be.equal(mockAddress);
      });
    });
    describe(`WHEN setFeeTokenPriceProviderAddress is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setFeeTokenPriceProviderAddress(mockAddress);
        expect(await mocProxy.feeTokenPriceProvider()).to.be.equal(mockAddress);
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
    describe(`WHEN setFeeTokenPct is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setFeeTokenPct(50);
        expect(await mocProxy.feeTokenPct()).to.be.equal(50);
      });
    });
    describe(`WHEN setTCInterestCollectorAddress is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setTCInterestCollectorAddress(mockAddress);
        expect(await mocProxy.tcInterestCollectorAddress()).to.be.equal(mockAddress);
      });
    });
    describe(`WHEN setTCInterestRate is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setTCInterestRate(51);
        expect(await mocProxy.tcInterestRate()).to.be.equal(51);
      });
    });
    describe(`WHEN setTCInterestPaymentBlockSpan is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setTCInterestPaymentBlockSpan(52);
        expect(await mocProxy.tcInterestPaymentBlockSpan()).to.be.equal(52);
      });
    });
    describe(`WHEN setMocVendors is invoked`, () => {
      it("THEN the new value is assigned", async function () {
        await mocProxy.setMocVendors(mockAddress);
        expect(await mocProxy.mocVendors()).to.be.equal(mockAddress);
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
    describe("WHEN setBes is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setBes(42));
      });
    });
    describe("WHEN setFeeRetainer is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setFeeRetainer(42));
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
    describe("WHEN setSwapTCforTPFee is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setSwapTCforTPFee(42));
      });
    });
    describe("WHEN setMintTCandTPFee is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setMintTCandTPFee(42));
      });
    });
    describe("WHEN setFeeTokenPct is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setFeeTokenPct(42));
      });
    });
    describe("WHEN setMocFeeFlowAddress is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setMocFeeFlowAddress(mockAddress));
      });
    });
    describe("WHEN setMocAppreciationBeneficiaryAddress is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setMocAppreciationBeneficiaryAddress(mockAddress));
      });
    });
    describe("WHEN setFeeTokenAddress is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setFeeTokenAddress(mockAddress));
      });
    });
    describe("WHEN setFeeTokenPriceProviderAddress is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setFeeTokenPriceProviderAddress(mockAddress));
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
    describe("WHEN setTCInterestCollectorAddress is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setTCInterestCollectorAddress(mockAddress));
      });
    });
    describe("WHEN setTCInterestRate is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setTCInterestRate(42));
      });
    });
    describe("WHEN setTCInterestPaymentBlockSpan is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setTCInterestPaymentBlockSpan(42));
      });
    });
    describe("WHEN setMocVendors is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setMocVendors(mockAddress));
      });
    });
    describe("WHEN setMocCoreExpansion is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        await expectRevertNotAuthorized(mocProxy.setMocCoreExpansion(mockAddress));
      });
    });
  });
});
