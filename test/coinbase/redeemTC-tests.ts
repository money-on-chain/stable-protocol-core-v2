import { fixtureDeployedMocCoinbase } from "./fixture";
import { MocCACoinbase, MocRC20, NonPayableMock, PriceProviderMock, ReentrancyAttackerMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { redeemTCBehavior } from "../behaviors/redeemTC.behavior";
import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { ERRORS, pEth } from "../helpers/utils";
import { Address } from "hardhat-deploy/types";

describe("Feature: MocCoinbase redeem TC", function () {
  let mocImpl: MocCACoinbase;
  let mocCollateralToken: MocRC20;
  let mocPeggedTokens: MocRC20[];
  let priceProviders: PriceProviderMock[];
  let mocFunctions: any;
  let deployer: Address;

  describe("GIVEN a MocCoinbase implementation deployed", function () {
    beforeEach(async function () {
      ({ deployer } = await getNamedAccounts());
      const fixtureDeploy = fixtureDeployedMocCoinbase(5);
      ({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders } = await fixtureDeploy());
      mocFunctions = await mocFunctionsCoinbase({ mocImpl, mocCollateralToken, mocPeggedTokens, priceProviders });
      this.mocFunctions = mocFunctions;
      this.mocContracts = { mocImpl, mocCollateralToken, mocPeggedTokens };
    });
    redeemTCBehavior();
    describe("AND a non payable contract", () => {
      let nonPayable: NonPayableMock;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("NonPayableMock");
        nonPayable = await factory.deploy();
      });
      describe("WHEN it tries to redeemTC", () => {
        it("THEN tx fails because contract cannot receive the coinbase as Collateral Asset", async () => {
          // mint TC to non payable contract
          await mocFunctions.mintTCto({ from: deployer, to: nonPayable.address, qTC: 1000 });
          const data = mocImpl.interface.encodeFunctionData("redeemTC", [pEth(1), 0]);
          await expect(nonPayable.forward(mocImpl.address, data)).to.be.revertedWithCustomError(
            mocImpl,
            ERRORS.TRANSFER_FAIL,
          );
        });
      });
      describe("WHEN a TC holder tries to redeemTC to it", () => {
        it("THEN tx fails because contract cannot receive the coinbase as Collateral Asset", async () => {
          // mint TC to deployer
          await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
          await expect(
            mocFunctions.redeemTCto({ from: deployer, to: nonPayable.address, qTC: 1000 }),
          ).to.be.revertedWithCustomError(mocImpl, ERRORS.TRANSFER_FAIL);
        });
      });
    });

    describe("WHEN a reentracy attacker contract reentrant redeemTC", () => {
      let reentrancyAttacker: ReentrancyAttackerMock;
      beforeEach(async () => {
        const factory = await ethers.getContractFactory("ReentrancyAttackerMock");
        reentrancyAttacker = await factory.deploy();
        // mint TC to reentracy attacker contract
        await mocFunctions.mintTCto({ from: deployer, to: reentrancyAttacker.address, qTC: 1000 });
      });
      it("THEN tx fails because there is a reentrant call", async () => {
        const data = mocImpl.interface.encodeFunctionData("redeemTC", [pEth(1), 0]);
        await expect(reentrancyAttacker.forward(mocImpl.address, data, false)).to.be.revertedWith(
          ERRORS.REENTRACYGUARD,
        );
      });
    });
  });
});
