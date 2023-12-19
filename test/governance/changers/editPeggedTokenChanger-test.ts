import { expect } from "chai";
import { ethers, getNamedAccounts } from "hardhat";
import { Contract, ContractTransaction } from "ethers";
import { fixtureDeployedMocCoinbase } from "../../coinbase/fixture";
import { assertPrec } from "../../helpers/assertHelper";
import {
  EditPeggedTokenChangerTemplate,
  EditPeggedTokenChangerTemplate__factory,
  IChangeContract__factory,
  MocCACoinbase,
  MocRC20,
  PriceProviderMock,
} from "../../../typechain";
import {
  ERRORS,
  deployPriceProvider,
  pEth,
  tpParamsDefault,
  deployAeropagusGovernor,
  tpParams,
} from "../../helpers/utils";
import { deployChangerClosure } from "./addPeggedTokenChanger-test";

describe("Feature: Governance protected Pegged Token edition ", () => {
  let mocProxy: MocCACoinbase;
  let governor: Contract;
  let changeContract: EditPeggedTokenChangerTemplate;
  let mocPeggedToken: MocRC20;
  let priceProvider: PriceProviderMock;
  let newPriceProvider: PriceProviderMock;
  let changerFactory: any;

  before(async () => {
    const { deployer } = await getNamedAccounts();
    const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
    ({ mocImpl: mocProxy } = await fixtureDeploy());

    // set a real governor
    governor = await deployAeropagusGovernor(deployer);
    await mocProxy.changeGovernor(governor.address);

    let deployAddChanger: any;
    ({ deployAddChanger, mocPeggedToken, priceProvider } = await deployChangerClosure(mocProxy)());
    const addChangerContract = await deployAddChanger();
    governor.executeChange(addChangerContract.address);

    changerFactory = await ethers.getContractFactory("EditPeggedTokenChangerTemplate");
  });
  describe("WHEN trying to setup an edit Changer with invalid token address value", () => {
    it("THEN tx fails because tp must be a member", async () => {
      await expect(changerFactory.deploy(mocProxy.address, priceProvider.address)).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_ADDRESS,
      );
    });
  });

  describe("GIVEN a Changer contract is set up to edit a Pegged Token", () => {
    beforeEach(async () => {
      const deployedChanger = await changerFactory.deploy(mocProxy.address, mocPeggedToken.address);
      changeContract = EditPeggedTokenChangerTemplate__factory.connect(
        deployedChanger.address,
        ethers.provider.getSigner(),
      );
    });
    describe("WHEN the changer is executed", () => {
      it("THEN it fails as the param is not yet set", async function () {
        await expect(governor.executeChange(changeContract.address)).to.be.revertedWithCustomError(
          changeContract,
          "InvalidParamSetCount",
        );
      });
    });
    describe("WHEN an unauthorized account tries to set the Price Provider", () => {
      it("THEN it fails", async function () {
        newPriceProvider = await deployPriceProvider(pEth(1));
        const { alice } = await getNamedAccounts();
        await expect(
          changeContract.connect(await ethers.getSigner(alice)).setPriceProvider(newPriceProvider.address),
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
    describe("GIVEN a new PriceProvider is set on the changer", () => {
      beforeEach(async () => {
        newPriceProvider = await deployPriceProvider(pEth(42));
        await changeContract.setPriceProvider(newPriceProvider.address);
      });
      describe("WHEN deployer tries to set it again", () => {
        it("THEN it fails", async function () {
          await expect(changeContract.setPriceProvider(newPriceProvider.address)).to.be.revertedWithCustomError(
            changeContract,
            "InvalidParamSetCount",
          );
        });
      });
      describe("WHEN an unauthorized account executes the changer", () => {
        it("THEN it fails", async function () {
          const changerTemplate = IChangeContract__factory.connect(changeContract.address, ethers.provider.getSigner());
          await expect(changerTemplate.execute()).to.be.revertedWithCustomError(mocProxy, ERRORS.NOT_AUTH_CHANGER);
        });
      });
      describe("WHEN a the governor executes the changer contract", () => {
        let execTx: ContractTransaction;
        beforeEach(async function () {
          execTx = await governor.executeChange(changeContract.address);
        });
        it("THEN only the Pegged Token Price Provider is changed", async function () {
          await expect(execTx).to.emit(mocProxy, "PeggedTokenChange").withArgs(tpParams.length, [
            mocPeggedToken.address,
            newPriceProvider.address, // <---- New Price Provider
            tpParamsDefault.ctarg,
            tpParamsDefault.mintFee,
            tpParamsDefault.redeemFee,
            0, // Initial Emma is not set
            tpParamsDefault.smoothingFactor,
          ]);
        });
        it("THEN getPACtp returns the new price", async function () {
          assertPrec(42, await mocProxy.getPACtp(mocPeggedToken.address));
        });
        describe("AND the governor tries to execute it again", () => {
          it("THEN it fails", async function () {
            await expect(governor.executeChange(changeContract.address)).to.be.revertedWithCustomError(
              changeContract,
              "InvalidParamSetCount",
            );
          });
        });
      });
    });
  });
});
