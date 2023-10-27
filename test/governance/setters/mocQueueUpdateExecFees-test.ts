import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import memoizee from "memoizee";
import { GovernorMock, GovernorMock__factory, MocQueue, MocQueue__factory } from "../../../typechain";
import { ERRORS } from "../../helpers/utils";
import { getNetworkDeployParams } from "../../../scripts/utils";
import { DeployParameters } from "../../../scripts/types";

const fixtureDeploy = memoizee(
  (): (() => Promise<{
    mocQueue: MocQueue;
  }>) => {
    return deployments.createFixture(async ({ ethers }) => {
      await deployments.fixture();
      const signer = ethers.provider.getSigner();

      const deployedMocQueue = await deployments.getOrNull("MocQueueProxy");
      if (!deployedMocQueue) throw new Error("No MocQueue deployed.");
      const mocQueue: MocQueue = MocQueue__factory.connect(deployedMocQueue.address, signer);

      return {
        mocQueue,
      };
    });
  },
);

describe("Feature: MocQueue execution fees update", () => {
  let governorMock: GovernorMock;
  let mocQueue: MocQueue;
  const execFeeKeys = [
    "tcMintExecFee",
    "tcRedeemExecFee",
    "tpMintExecFee",
    "tpRedeemExecFee",
    "swapTPforTPExecFee",
    "swapTPforTCExecFee",
    "swapTCforTPExecFee",
    "redeemTCandTPExecFee",
    "mintTCandTPExecFee",
  ];

  before(async () => {
    ({ mocQueue } = await fixtureDeploy()());
    const governorAddress = await mocQueue.governor();
    governorMock = GovernorMock__factory.connect(governorAddress, ethers.provider.getSigner());
  });

  describe("GIVEN the Governor has authorized the change AND mocQueue is empty", () => {
    let execFeeParams: DeployParameters["queueParams"]["execFeeParams"];
    let expectExecutionFee: (expectedFees: any) => any;
    before(async () => {
      await governorMock.setIsAuthorized(true);
      ({ execFeeParams } = getNetworkDeployParams(hre).queueParams);
      expectExecutionFee = (expectedFees: any) => {
        return Promise.all(
          execFeeKeys.map((key: string) =>
            // @ts-ignore
            mocQueue[key]().then((value: number) => expect(expectedFees[key], key).to.be.equal(value)),
          ),
        );
      };
    });
    describe("AND mocQueue is empty", () => {
      execFeeKeys.forEach(execFeeKey => {
        describe(`WHEN updateExecutionFees is invoked to update ${execFeeKey}`, () => {
          it(`THEN only ${execFeeKey} is updated`, async function () {
            const execFeeParamsToUpdate = Object.assign({}, execFeeParams, { [execFeeKey]: 42 });
            await mocQueue.updateExecutionFees(execFeeParamsToUpdate);
            await expectExecutionFee(execFeeParamsToUpdate);
          });
        });
      });
    });
  });
  describe("GIVEN the Governor has not authorized the change", () => {
    before(async () => {
      await governorMock.setIsAuthorized(false);
    });
    describe("WHEN updateExecutionFees is invoked", () => {
      it("THEN it fails, as it's protected by onlyAuthorizedChanger", async function () {
        const { execFeeParams } = getNetworkDeployParams(hre).queueParams;
        await expect(mocQueue.updateExecutionFees(execFeeParams)).to.be.revertedWithCustomError(
          mocQueue,
          ERRORS.NOT_AUTH_CHANGER,
        );
      });
    });
  });
});
