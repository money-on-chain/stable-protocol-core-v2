import { expect } from "chai";
import { ethers, getNamedAccounts } from "hardhat";
import { Contract } from "ethers";
import { tpParams } from "../../../../deploy-config/config";
import { fixtureDeployGovernance } from "../coinbase/fixture";
import { MocCACoinbase } from "../../../../typechain";
import { GovernanceChangerTemplate__factory } from "../../../../typechain/factories/contracts/governance/changerTemplates/GovernanceChangerTemplate__factory";
import { deployPeggedToken, deployPriceProvider, ERRORS, pEth } from "../../../helpers/utils";

const fixtureDeploy = fixtureDeployGovernance();

describe("Feature: Add Pegged Token", () => {
  let mocProxy: MocCACoinbase;
  let governor: Contract;
  let changeContract: Contract;
  let peggedToken: Contract;
  let priceProvider: Contract;

  const getInitParam = () => {
    const addPeggedTokenParams1 = {
      tpTokenAddress: peggedToken.address,
      priceProviderAddress: priceProvider.address,
      tpR: tpParams.r,
      tpBmin: tpParams.bmin,
      tpMintFee: tpParams.mintFee,
      tpRedeemFee: tpParams.redeemFee,
      tpEma: tpParams.initialEma,
      tpEmaSf: tpParams.smoothingFactor,
      tpTils: tpParams.tils,
      tpTiMin: tpParams.tiMin,
      tpTiMax: tpParams.tiMax,
      tpAbeq: tpParams.abeq,
    };
    const addPeggedTokenParams2 = {
      tpFacMin: tpParams.facMin,
      tpFacMax: tpParams.facMax,
    };
    return { addPeggedTokenParams1, addPeggedTokenParams2 };
  };

  before(async () => {
    ({ mocCACoinbase: mocProxy, governor } = await fixtureDeploy());

    const changerFactory = await ethers.getContractFactory("AddPeggedTokenChangerTemplate");

    peggedToken = await deployPeggedToken({ mocImplAddress: mocProxy.address });
    priceProvider = await deployPriceProvider(pEth(1));

    changeContract = await changerFactory.deploy(mocProxy.address);
  });

  describe("GIVEN a Changer contract is set up to add a new Pegged Token", () => {
    describe("WHEN a unauthorized account tries to initialize it", () => {
      it("THEN it fails as only owner can", async function () {
        const { alice } = await getNamedAccounts();
        const signer = await ethers.getSigner(alice);
        const { addPeggedTokenParams1, addPeggedTokenParams2 } = getInitParam();
        await expect(
          changeContract.connect(signer).initialize(addPeggedTokenParams1, addPeggedTokenParams2),
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
    describe("AND it's correctly initialized", () => {
      before(async () => {
        const { addPeggedTokenParams1, addPeggedTokenParams2 } = getInitParam();
        await changeContract.initialize(addPeggedTokenParams1, addPeggedTokenParams2);
      });
      describe("WHEN owner executes initialize again", () => {
        it("THEN it fails", async function () {
          const { addPeggedTokenParams1, addPeggedTokenParams2 } = getInitParam();
          await expect(changeContract.initialize(addPeggedTokenParams1, addPeggedTokenParams2)).to.be.revertedWith(
            ERRORS.CONTRACT_INITIALIZED,
          );
        });
      });
      describe("WHEN a unauthorized account executed the changer", () => {
        it("THEN it fails", async function () {
          const governanceChangerTemplate = GovernanceChangerTemplate__factory.connect(
            changeContract.address,
            ethers.provider.getSigner(),
          );
          await expect(governanceChangerTemplate.execute()).to.be.revertedWithCustomError(
            mocProxy,
            ERRORS.NOT_AUTH_CHANGER,
          );
        });
      });
      describe("WHEN a the governor executes the changer contract", () => {
        it("THEN the new Pegged Token is added", async function () {
          await expect(governor.executeChange(changeContract.address))
            .to.emit(mocProxy, "PeggedTokenAdded")
            .withArgs(
              0,
              peggedToken.address,
              priceProvider.address,
              tpParams.r,
              tpParams.bmin,
              tpParams.mintFee,
              tpParams.redeemFee,
              tpParams.initialEma,
              tpParams.smoothingFactor,
              tpParams.tils,
              tpParams.tiMin,
              tpParams.tiMax,
              tpParams.abeq,
              tpParams.facMin,
              tpParams.facMax,
            );
        });
      });
    });
  });
});
