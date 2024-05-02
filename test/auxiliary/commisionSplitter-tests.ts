import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { Address } from "hardhat-deploy/types";
import { CommissionSplitter, ERC20Mock, ERC20Mock__factory } from "../../typechain";
import { deployCommissionSplitter, pEth } from "../helpers/utils";

describe("Feature: Commission Splitter", () => {
  let acToken: ERC20Mock;
  let feeToken: ERC20Mock;
  let commissionSplitter: CommissionSplitter;
  let alice: Address, bob: Address, deployer: Address;
  describe("GIVEN there is a CommissionSplitter", () => {
    before(async () => {
      ({ alice, bob, deployer } = await getNamedAccounts());
      const signer = ethers.provider.getSigner();

      const rc20MockFactory = await ethers.getContractFactory("ERC20Mock");
      const acTokenAddress = (await rc20MockFactory.deploy()).address;
      acToken = ERC20Mock__factory.connect(acTokenAddress, signer);
      const feeTokenAddress = (await rc20MockFactory.deploy()).address;
      feeToken = ERC20Mock__factory.connect(feeTokenAddress, signer);

      // Governor is not relevant for this tests
      const governorAddress = deployer;
      const initParams = {
        governorAddress,
        acToken: acTokenAddress,
        feeToken: feeTokenAddress,
        acTokenAddressRecipient1: alice,
        acTokenAddressRecipient2: bob,
        acTokenPctToRecipient1: pEth("6").div(10), // 60%
        feeTokenAddressRecipient1: alice,
        feeTokenAddressRecipient2: bob,
        feeTokenPctToRecipient1: pEth("3").div(10), // 30%
      };
      commissionSplitter = await deployCommissionSplitter(initParams);
    });
    describe("WHEN AC Tokens funds are transfer to it and splitted", () => {
      before(async () => {
        await acToken.mint(deployer, pEth(1000));
        await acToken.transfer(commissionSplitter.address, pEth(100));
        await feeToken.mint(deployer, pEth(10000));
        await feeToken.transfer(commissionSplitter.address, pEth(1000));
        await commissionSplitter.split();
        await acToken.transfer(commissionSplitter.address, pEth(200));
        await feeToken.transfer(commissionSplitter.address, pEth(100));
        await commissionSplitter.split();
      });
      it("THEN recipients gets their corresponding AC share", async () => {
        expect(await acToken.balanceOf(alice)).to.be.equal(pEth(180));
        expect(await acToken.balanceOf(bob)).to.be.equal(pEth(120));
      });
      it("THEN recipients gets their corresponding Fee Token share", async () => {
        expect(await feeToken.balanceOf(alice)).to.be.equal(pEth(330));
        expect(await feeToken.balanceOf(bob)).to.be.equal(pEth(770));
      });
    });
  });
});
