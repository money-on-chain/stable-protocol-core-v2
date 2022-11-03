import { expect } from "chai";
import { ethers } from "hardhat";
import { fixtureDeployGovernance } from "../upgradability/collateralBag/fixture";
import { IChangeContract__factory, MocCAWrapper } from "../../../typechain";
import { deployAsset, deployPriceProvider, ERRORS, pEth } from "../../helpers/utils";
import { Contract } from "ethers";

const fixtureDeploy = fixtureDeployGovernance();

describe("Feature: Governance protected CA Wrapper Asset addition ", () => {
  let mocCAWrapper: MocCAWrapper;
  let governor: Contract;
  let changeContract: Contract;
  let newAsset: Contract;
  let priceProvider: Contract;

  before(async () => {
    ({ MocCAWrapper: mocCAWrapper, governor } = await fixtureDeploy());

    const changerFactory = await ethers.getContractFactory("AddCAWrapperAssetChangerTemplate");

    newAsset = await deployAsset();
    priceProvider = await deployPriceProvider(pEth(1));

    changeContract = await changerFactory.deploy(mocCAWrapper.address, newAsset.address, priceProvider.address);
  });

  describe("GIVEN a Changer contract is set up to add a new Asset", () => {
    describe("WHEN a unauthorized account executed the changer", () => {
      it("THEN it fails", async function () {
        const changerTemplate = IChangeContract__factory.connect(changeContract.address, ethers.provider.getSigner());
        await expect(changerTemplate.execute()).to.be.revertedWithCustomError(mocCAWrapper, ERRORS.NOT_AUTH_CHANGER);
      });
    });
    describe("WHEN a the governor executes the changer contract", () => {
      it("THEN the new Asset is added", async function () {
        await expect(governor.executeChange(changeContract.address))
          .to.emit(mocCAWrapper, "AssetModified")
          .withArgs(newAsset.address, priceProvider.address);
      });
    });
  });
});
