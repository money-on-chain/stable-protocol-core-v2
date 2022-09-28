import { fixtureDeployedMocCoinbase } from "./fixture";
import { MocCACoinbase, MocRC20, NonPayableMock, PriceProviderMock, ReentrancyAttackerMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { mintTCBehavior } from "../behaviors/mintTC.behavior";
import { ethers } from "hardhat";
import { expect } from "chai";
import { ERRORS, pEth } from "../helpers/utils";
import { tpParams } from "../helpers/utils";

describe("Feature: MocCoinbase mint TC", function () {
  let mocImpl: MocCACoinbase;
  let mocCollateralToken: MocRC20;
  let mocPeggedTokens: MocRC20[];
  let priceProviders: PriceProviderMock[];

  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
      ({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders } = await fixtureDeploy());
      this.mocFunctions = await mocFunctionsCoinbase({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders });
      this.mocContracts = { mocImpl, mocCollateralToken };
    });
    mintTCBehavior();

    describe("WHEN a non payable contract tries to mintTC with exceeded amount of coinbase", () => {
      let nonPayable: NonPayableMock;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("NonPayableMock");
        nonPayable = await factory.deploy();
      });
      it("THEN tx fails because contract cannot receive the surplus", async () => {
        const data = mocImpl.interface.encodeFunctionData("mintTC", [pEth(1)]);
        await expect(nonPayable.forward(mocImpl.address, data, { value: pEth(100) })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.TRANSFER_FAIL,
        );
      });
    });

    describe("WHEN a reentracy attacker contract reentrant mintTC", () => {
      let reentrancyAttacker: ReentrancyAttackerMock;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("ReentrancyAttackerMock");
        reentrancyAttacker = await factory.deploy();
      });
      it("THEN tx fails because there is a reentrant call", async () => {
        const data = mocImpl.interface.encodeFunctionData("mintTC", [pEth(1)]);
        await expect(reentrancyAttacker.forward(mocImpl.address, data, true, { value: pEth(100) })).to.be.revertedWith(
          ERRORS.REENTRACYGUARD,
        );
      });
    });
  });
});
