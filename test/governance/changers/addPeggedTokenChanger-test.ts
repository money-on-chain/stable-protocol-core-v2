import { expect } from "chai";
import { ethers, getNamedAccounts } from "hardhat";
import { BigNumberish, BigNumber, Contract, ContractFactory, ContractTransaction } from "ethers";
import { Address } from "hardhat-deploy/types";
import { fixtureDeployedMocCoinbase } from "../../coinbase/fixture";
import { IChangeContract__factory, MocCACoinbase, MocCore, MocRC20 } from "../../../typechain";
import {
  BURNER_ROLE,
  DEFAULT_ADMIN_ROLE,
  MINTER_ROLE,
  ERRORS,
  deployPeggedToken,
  deployPriceProvider,
  pEth,
  CONSTANTS,
  tpParamsDefault,
  tpParams,
  deployAeropagusGovernor,
} from "../../helpers/utils";
import { assertPrec } from "../../helpers/assertHelper";

export function deployChangerClosure(mocProxy: MocCore) {
  return async () => {
    const changerFactory = await ethers.getContractFactory("AddPeggedTokenChangerTemplate");
    const governorAddress = await mocProxy.governor();
    const mocPeggedToken = await deployPeggedToken({ adminAddress: mocProxy.address, governorAddress });
    const priceProvider = await deployPriceProvider(pEth(1));

    const deployAddChanger = ({
      tpTokenAddress = mocPeggedToken.address,
      priceProviderAddress = priceProvider.address,
      tpCtarg = tpParamsDefault.ctarg,
      tpMintFee = tpParamsDefault.mintFee,
      tpRedeemFee = tpParamsDefault.redeemFee,
      tpEma = tpParamsDefault.initialEma,
      tpEmaSf = tpParamsDefault.smoothingFactor,
    }: {
      tpTokenAddress?: Address;
      priceProviderAddress?: Address;
      tpCtarg?: BigNumberish;
      tpMintFee?: BigNumberish;
      tpRedeemFee?: BigNumberish;
      tpEma?: BigNumberish;
      tpEmaSf?: BigNumberish;
    } = {}) => {
      return changerFactory.deploy(mocProxy.address, {
        tpTokenAddress,
        priceProviderAddress,
        tpCtarg,
        tpMintFee,
        tpRedeemFee,
        tpEma,
        tpEmaSf,
      });
    };
    return { mocPeggedToken, priceProvider, deployAddChanger };
  };
}

describe("Feature: Governance protected Pegged Token addition ", () => {
  let mocProxy: MocCACoinbase;
  let governor: Contract;
  let changeContract: Contract;
  let mocPeggedToken: Contract;
  let priceProvider: Contract;
  let deployChanger: any;
  let deployer: Address;
  before(async () => {
    ({ deployer } = await getNamedAccounts());
    const fixtureDeploy = fixtureDeployedMocCoinbase(tpParams.length, tpParams);
    ({ mocImpl: mocProxy } = await fixtureDeploy());

    // set a real governor
    governor = await deployAeropagusGovernor(deployer);
    await mocProxy.changeGovernor(governor.address);

    ({ deployAddChanger: deployChanger, mocPeggedToken, priceProvider } = await deployChangerClosure(mocProxy)());
  });
  describe("WHEN trying to setup a Changer with invalid target coverage value", () => {
    it("THEN tx fails because target coverage is below ONE", async () => {
      await expect(deployChanger({ tpCtarg: CONSTANTS.ONE.sub(1) })).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_VALUE,
      );
    });
  });
  describe("WHEN trying to setup a Changer with invalid mint fee value", () => {
    it("THEN tx fails because mint fee is above ONE", async () => {
      await expect(deployChanger({ tpMintFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_VALUE,
      );
    });
  });
  describe("WHEN trying to setup a Changer with invalid redeem fee value", () => {
    it("THEN tx fails because redeem fee is above ONE", async () => {
      await expect(deployChanger({ tpRedeemFee: CONSTANTS.ONE.add(1) })).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_VALUE,
      );
    });
  });
  describe("WHEN trying to setup a Changer with invalid ema smoothing factor value", () => {
    it("THEN tx fails because ema smoothing factor is above ONE", async () => {
      await expect(deployChanger({ tpEmaSf: CONSTANTS.ONE })).to.be.revertedWithCustomError(
        mocProxy,
        ERRORS.INVALID_VALUE,
      );
    });
  });
  describe("GIVEN a new Pegged Token with roles assigned to the deployer", () => {
    let fakePeggedToken: MocRC20;
    let changer: ContractFactory;
    let transferRole: (role: string) => Promise<void>;
    beforeEach(async () => {
      fakePeggedToken = await deployPeggedToken({
        adminAddress: deployer,
        governorAddress: await mocProxy.governor(),
      });
      changer = await ethers.getContractFactory("AddPeggedTokenChangerTemplate");
      transferRole = async (role: string) => {
        await fakePeggedToken.grantRole(role, mocProxy.address);
        await fakePeggedToken.renounceRole(role, deployer);
      };
    });
    describe("WHEN trying to setup a Changer without transferring Minter role to MocCore", () => {
      it("THEN tx fails because MocCore hasn't got the Minter roles", async () => {
        await transferRole(BURNER_ROLE);
        await transferRole(DEFAULT_ADMIN_ROLE);
        await expect(deployChanger({ tpTokenAddress: fakePeggedToken.address })).to.be.revertedWithCustomError(
          changer,
          ERRORS.INVALID_ROLES,
        );
      });
    });
    describe("WHEN trying to setup a Changer without transferring Burner role to MocCore", () => {
      it("THEN tx fails because MocCore hasn't got the Burner roles", async () => {
        await transferRole(MINTER_ROLE);
        await transferRole(DEFAULT_ADMIN_ROLE);
        await expect(deployChanger({ tpTokenAddress: fakePeggedToken.address })).to.be.revertedWithCustomError(
          changer,
          ERRORS.INVALID_ROLES,
        );
      });
    });
    describe("WHEN trying to setup a Changer without transferring Admin role to MocCore", () => {
      it("THEN tx fails because MocCore hasn't got the Admin roles", async () => {
        await transferRole(MINTER_ROLE);
        await transferRole(BURNER_ROLE);
        await expect(deployChanger({ tpTokenAddress: fakePeggedToken.address })).to.be.revertedWithCustomError(
          changer,
          ERRORS.INVALID_ROLES,
        );
      });
    });
    describe("WHEN trying to setup a Changer without renouncing Minter role", () => {
      it("THEN tx fails because MocCore is not the only one with Minter role", async () => {
        await fakePeggedToken.grantRole(MINTER_ROLE, mocProxy.address);
        await transferRole(BURNER_ROLE);
        await transferRole(DEFAULT_ADMIN_ROLE);
        await expect(deployChanger({ tpTokenAddress: fakePeggedToken.address })).to.be.revertedWithCustomError(
          changer,
          ERRORS.INVALID_ROLES,
        );
      });
    });
    describe("WHEN trying to setup a Changer without renouncing Burner role", () => {
      it("THEN tx fails because MocCore is not the only one with Burner role", async () => {
        await fakePeggedToken.grantRole(BURNER_ROLE, mocProxy.address);
        await transferRole(MINTER_ROLE);
        await transferRole(DEFAULT_ADMIN_ROLE);
        await expect(deployChanger({ tpTokenAddress: fakePeggedToken.address })).to.be.revertedWithCustomError(
          changer,
          ERRORS.INVALID_ROLES,
        );
      });
    });
    describe("WHEN trying to setup a Changer without renouncing Admin role", () => {
      it("THEN tx fails because MocCore is not the only one with Admin role", async () => {
        await fakePeggedToken.grantRole(DEFAULT_ADMIN_ROLE, mocProxy.address);
        await transferRole(MINTER_ROLE);
        await transferRole(BURNER_ROLE);
        await expect(deployChanger({ tpTokenAddress: fakePeggedToken.address })).to.be.revertedWithCustomError(
          changer,
          ERRORS.INVALID_ROLES,
        );
      });
    });
  });
  describe("GIVEN a new Pegged Token with a different governor set", () => {
    let fakePeggedToken: MocRC20;
    before(async () => {
      fakePeggedToken = await deployPeggedToken({
        adminAddress: mocProxy.address,
        governorAddress: deployer,
      });
    });
    describe("WHEN trying to setup a Changer", () => {
      it("THEN tx fails because has a different governor", async () => {
        await expect(deployChanger({ tpTokenAddress: fakePeggedToken.address })).to.be.revertedWithCustomError(
          await ethers.getContractFactory("AddPeggedTokenChangerTemplate"),
          ERRORS.INVALID_GOVERNOR,
        );
      });
    });
  });
  describe("GIVEN a Changer contract is set up to add a new Pegged Token", () => {
    before(async () => {
      changeContract = await deployChanger(); // with default params
    });
    describe("WHEN an unauthorized account executed the changer", () => {
      it("THEN it fails", async function () {
        const changerTemplate = IChangeContract__factory.connect(changeContract.address, ethers.provider.getSigner());
        await expect(changerTemplate.execute()).to.be.revertedWithCustomError(mocProxy, ERRORS.NOT_AUTH_CHANGER);
      });
    });
    describe("WHEN a the governor executes the changer contract", () => {
      let execTx: ContractTransaction;
      let prevTpAmount: BigNumber;
      before(async () => {
        prevTpAmount = await mocProxy.getTpAmount();
        execTx = await governor.executeChange(changeContract.address);
      });
      it("THEN the new Pegged Token is added", async function () {
        await expect(execTx)
          .to.emit(mocProxy, "PeggedTokenChange")
          .withArgs(tpParams.length, [
            mocPeggedToken.address,
            priceProvider.address,
            tpParamsDefault.ctarg,
            tpParamsDefault.mintFee,
            tpParamsDefault.redeemFee,
            tpParamsDefault.initialEma,
            tpParamsDefault.smoothingFactor,
          ]);
      });
      it("THEN we can access getPACtp", async function () {
        assertPrec(1, await mocProxy.getPACtp(mocPeggedToken.address));
      });
      it("THEN getTPAmount returns is increased", async function () {
        expect(prevTpAmount.add(1)).to.be.equal(await mocProxy.getTpAmount());
      });
    });
  });
});
