import { fixtureDeployedMocCoinbase } from "./fixture";
import { MocCACoinbase, MocRC20, NonPayableMock, PriceProviderMock, ReentrancyAttackerMock } from "../../typechain";
import { mocFunctionsCoinbase } from "../helpers/mocFunctionsCoinbase";
import { mintTPBehavior } from "../behaviors/mintTP.behavior";
import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { ERRORS, pEth } from "../helpers/utils";
import { Address } from "hardhat-deploy/types";

describe("Feature: MocCoinbase mint TP", function () {
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
    mintTPBehavior();

    describe("WHEN a non payable contract tries to mintTP with exceeded amount of coinbase", () => {
      let nonPayable: NonPayableMock;
      beforeEach(async () => {
        //add collateral
        await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
        const factory = await ethers.getContractFactory("NonPayableMock");
        nonPayable = await factory.deploy();
      });
      it("THEN tx fails because contract cannot receive the surplus", async () => {
        const data = mocImpl.interface.encodeFunctionData("mintTP", [0, pEth(1)]);
        await expect(nonPayable.forward(mocImpl.address, data, { value: pEth(100) })).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.TRANSFER_FAIL,
        );
      });
    });

    describe("WHEN a reentracy attacker contract reentrant mintTP", () => {
      let reentrancyAttacker: ReentrancyAttackerMock;
      beforeEach(async () => {
        //add collateral
        await mocFunctions.mintTC({ from: deployer, qTC: 1000 });
        const factory = await ethers.getContractFactory("ReentrancyAttackerMock");
        reentrancyAttacker = await factory.deploy();
      });
      it("THEN tx fails because there is a reentrant call", async () => {
        const data = mocImpl.interface.encodeFunctionData("mintTP", [0, pEth(1)]);
        await expect(reentrancyAttacker.forward(mocImpl.address, data, true, { value: pEth(100) })).to.be.revertedWith(
          ERRORS.REENTRACYGUARD,
        );
      });
    });
  });
});
