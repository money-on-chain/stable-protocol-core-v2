import { BigNumber } from "@ethersproject/bignumber";
import { Address } from "hardhat-deploy/types";
import { expect } from "chai";
import { ethers, getNamedAccounts } from "hardhat";
import { ERC20Mock, MocCAWrapper, MocRC20, MocTC } from "../../typechain";
import { deployAsset, deployPriceProvider, pEth } from "../helpers/utils";
import { fixtureDeployedMocCABag } from "./fixture";

describe("Feature: MocCAWrapper with different decimal based assets", function () {
  let mocWrapper: MocCAWrapper;
  let mocCollateralToken: MocTC;
  let wcaToken: MocRC20;
  let asset18: ERC20Mock;
  let asset8: ERC20Mock;
  let asset24: ERC20Mock;
  let alice: Address;
  let mocFeeFlow: Address;

  const fixtureDeploy = fixtureDeployedMocCABag(1, undefined, 1);

  describe("GIVEN there is a MocWrapper with assets of 18, 8 and 24 decimals", function () {
    before(async function () {
      ({ alice, otherUser: mocFeeFlow } = await getNamedAccounts());

      const mocContracts = await fixtureDeploy();
      ({
        assets: [asset18],
        mocWrapper,
        mocCollateralToken,
        wcaToken,
      } = mocContracts);
      await mocContracts.mocImpl.setMocFeeFlowAddress(mocFeeFlow);

      const shifterFactory = await ethers.getContractFactory("PriceProviderShifter");

      asset8 = await deployAsset();
      await asset8.setDecimals(8);
      // Both assets has the same price (= 1)
      const priceProvider8 = await deployPriceProvider(pEth(1));
      // We need to shift this price provider value 10 places, to get to 18 parity
      const shiftedPriceProvider8 = await shifterFactory.deploy(priceProvider8.address, 10);
      await mocWrapper.addOrEditAsset(asset8.address, shiftedPriceProvider8.address, await asset8.decimals());

      asset24 = await deployAsset();
      await asset24.setDecimals(24);
      // Both assets has the same price (= 1)
      const priceProvider24 = await deployPriceProvider(pEth(1));
      // We need to shift this price provider value -6 places, to get to 18 parity
      const shiftedPriceProvider24 = await shifterFactory.deploy(priceProvider24.address, -6);
      await mocWrapper.addOrEditAsset(asset24.address, shiftedPriceProvider24.address, await asset24.decimals());
    });
    describe("WHEN minting using equivalent value of asset 18 and 8, the results are the same", () => {
      before(async function () {
        const signer = await ethers.getSigner(alice);
        const qTC = pEth(10);
        // 10.5 in this Asset, are 10.5*10^18
        const qACmax18 = BigNumber.from((1e17).toString()).mul(105);
        await asset18.connect(signer).increaseAllowance(mocWrapper.address, qACmax18);
        await mocWrapper.connect(signer).mintTC(asset18.address, qTC, qACmax18);
        // 10.5 in this Asset, are 10.5*10^8
        const qACmax8 = BigNumber.from(1e7).mul(105);
        await asset8.connect(signer).increaseAllowance(mocWrapper.address, qACmax8);
        await mocWrapper.connect(signer).mintTC(asset8.address, qTC, qACmax8);
        // 10.5 in this Asset, are 10.5*10^24
        const qACmax24 = BigNumber.from((1e18).toString()).mul(1e5).mul(105);
        await asset24.connect(signer).increaseAllowance(mocWrapper.address, qACmax24);
        await mocWrapper.connect(signer).mintTC(asset24.address, qTC, qACmax24);
      });
      it("THEN she receives the same amount of Tokens", async () => {
        // Alice minted 10+10+10 even if she used same pegged tokens but with different based tokens
        await expect(await mocCollateralToken.balanceOf(alice)).to.be.equal(pEth(30));
      });
      it("THEN moc Fee Flow can unwrap to get 0.5 in each corresponding asset", async () => {
        // Moc Fee Flow, receives 5% of each operation (x3), 1.5 wrapAsset Collateral
        await expect(await wcaToken.balanceOf(mocFeeFlow)).to.be.equal(pEth(1.5));

        const signer = await ethers.getSigner(mocFeeFlow);
        await Promise.all(
          [asset8, asset18, asset24].map(asset =>
            mocWrapper.connect(signer).unwrapTo(asset.address, pEth(0.5), 0, mocFeeFlow),
          ),
        );
        await expect(await asset8.balanceOf(mocFeeFlow)).to.be.equal(BigNumber.from(1e7).mul(5));
        await expect(await asset18.balanceOf(mocFeeFlow)).to.be.equal(pEth(0.5));
        await expect(await asset24.balanceOf(mocFeeFlow)).to.be.equal(pEth(500000));
      });
    });
  });
});
