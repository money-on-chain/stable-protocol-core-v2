import { ethers, getNamedAccounts } from "hardhat";
import { Address } from "hardhat-deploy/types";
import { ERC20Mock, MocCAWrapper } from "../../typechain";
import { pEth } from "../helpers/utils";
import { mocFunctionsCABag } from "../helpers/mocFunctionsCABag";
import { assertPrec } from "../helpers/assertHelper";
import { fixtureDeployedMocCABag, MoCContracts } from "./fixture";

describe("Feature: MocCAWrapper Token price does not change under supply movement operations", function () {
  let mocWrapper: MocCAWrapper;
  let assets: ERC20Mock[];
  let mocFunctions: any;
  let alice: Address;
  let bob: Address;
  let mocFeeFlow: Address;
  let mocContracts: MoCContracts;
  const fixtureDeploy = fixtureDeployedMocCABag(1, undefined, 2);
  describe("GIVEN mocFeeFlow has accumulated MocCAWrapper tokens with a pegged asset", function () {
    beforeEach(async function () {
      ({ alice, bob, otherUser: mocFeeFlow } = await getNamedAccounts());

      mocContracts = await fixtureDeploy();
      // Set custom feeFlow address so that it can receive the funds
      await mocContracts.mocImpl.setMocFeeFlowAddress(mocFeeFlow);

      mocFunctions = await mocFunctionsCABag(mocContracts);
      ({ assets, mocWrapper } = mocContracts);

      await mocFunctions.mintTC({ from: alice, qTC: 10000, asset: assets[0] });
      await mocFunctions.mintTP({ i: 0, from: bob, qTP: 100, asset: assets[0] });
      await mocFunctions.mintTP({ i: 0, from: bob, qTP: 100, asset: assets[1] }); // low amount to avoid triggering liquidation
    });

    describe("WHEN mocFee address unwraps all of the unpegged collateral", () => {
      it("THEN price is mantained", async () => {
        // There are 60 total collateral wrapped tokens
        // 10200 * 0.05 = 510
        await assertPrec(510, await mocFunctions.acBalanceOf(mocFeeFlow));

        await mocContracts.assetPriceProviders[1].poke(pEth(0.01)); // high impact depegged
        const priceBefore = await mocContracts.mocWrapper.getTokenPrice();
        await mocWrapper
          .connect(await ethers.provider.getSigner(mocFeeFlow))
          .unwrapTo(assets[1].address, pEth(0.5), pEth(0.01), mocFeeFlow);
        const priceAfter = await mocContracts.mocWrapper.getTokenPrice();

        await assertPrec(priceBefore, priceAfter);
        await assertPrec(0, await mocContracts.assets[1].balanceOf(mocContracts.wcaToken.address));
      });
    });

    describe("WHEN more pegged tokens are minted", () => {
      it("THEN price is mantained", async () => {
        // There are 60 total collateral wrapped tokens
        // 10200 * 0.05 = 510
        await assertPrec(510, await mocFunctions.acBalanceOf(mocFeeFlow));

        await mocContracts.assetPriceProviders[1].poke(pEth(0.01)); // high impact depegged
        const priceBefore = await mocContracts.mocWrapper.getTokenPrice();
        await mocFunctions.mintTP({ i: 0, from: bob, qTP: 1, asset: assets[1], qACmax: 10000 });
        const priceAfter = await mocContracts.mocWrapper.getTokenPrice();

        await assertPrec(priceBefore, priceAfter);
      });
    });
  });
});
