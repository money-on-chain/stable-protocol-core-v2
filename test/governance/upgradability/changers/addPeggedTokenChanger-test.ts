import { expect } from "chai";
import { ethers } from "hardhat";
import { tpParamsDefault } from "../../../helpers/utils";
import { fixtureDeployGovernance } from "../coinbase/fixture";
import { IChangeContract__factory, MocCACoinbase } from "../../../../typechain";
import { deployPeggedToken, deployPriceProvider, ERRORS, pEth } from "../../../helpers/utils";
import { Contract } from "ethers";

const fixtureDeploy = fixtureDeployGovernance();

describe("Feature: Governance protected Pegged Token addition ", () => {
  let mocProxy: MocCACoinbase;
  let governor: Contract;
  let changeContract: Contract;
  let mocPeggedToken: Contract;
  let priceProvider: Contract;
  let addPeggedTokenParams: any;

  before(async () => {
    ({ mocCACoinbase: mocProxy, governor } = await fixtureDeploy());

    const changerFactory = await ethers.getContractFactory("AddPeggedTokenChangerTemplate");

    mocPeggedToken = await deployPeggedToken({ mocImplAddress: mocProxy.address });
    priceProvider = await deployPriceProvider(pEth(1));
    addPeggedTokenParams = {
      tpTokenAddress: mocPeggedToken.address,
      priceProviderAddress: priceProvider.address,
      tpCtarg: tpParamsDefault.ctarg,
      tpR: tpParamsDefault.r,
      tpBmin: tpParamsDefault.bmin,
      tpMintFee: tpParamsDefault.mintFee,
      tpRedeemFee: tpParamsDefault.redeemFee,
      tpEma: tpParamsDefault.initialEma,
      tpEmaSf: tpParamsDefault.smoothingFactor,
      tpTils: tpParamsDefault.tils,
      tpTiMin: tpParamsDefault.tiMin,
      tpTiMax: tpParamsDefault.tiMax,
      tpAbeq: tpParamsDefault.abeq,
      tpFacMin: tpParamsDefault.facMin,
      tpFacMax: tpParamsDefault.facMax,
    };
    changeContract = await changerFactory.deploy(mocProxy.address, addPeggedTokenParams);
  });

  describe("GIVEN a Changer contract is set up to add a new Pegged Token", () => {
    describe("WHEN a unauthorized account executed the changer", () => {
      it("THEN it fails", async function () {
        const changerTemplate = IChangeContract__factory.connect(changeContract.address, ethers.provider.getSigner());
        await expect(changerTemplate.execute()).to.be.revertedWithCustomError(mocProxy, ERRORS.NOT_AUTH_CHANGER);
      });
    });
    describe("WHEN a the governor executes the changer contract", () => {
      it("THEN the new Pegged Token is added", async function () {
        await expect(governor.executeChange(changeContract.address))
          .to.emit(mocProxy, "PeggedTokenAdded")
          .withArgs(0, [
            mocPeggedToken.address,
            priceProvider.address,
            tpParamsDefault.ctarg,
            tpParamsDefault.r,
            tpParamsDefault.bmin,
            tpParamsDefault.mintFee,
            tpParamsDefault.redeemFee,
            tpParamsDefault.initialEma,
            tpParamsDefault.smoothingFactor,
            tpParamsDefault.tils,
            tpParamsDefault.tiMin,
            tpParamsDefault.tiMax,
            tpParamsDefault.abeq,
            tpParamsDefault.facMin,
            tpParamsDefault.facMax,
          ]);
      });
    });
  });
});
