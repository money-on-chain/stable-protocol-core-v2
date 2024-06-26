import { expect } from "chai";
import { MocCARC20 } from "../../typechain";
import { fixtureDeployedMocRC20 } from "../rc20/fixture";
import { ERRORS, mineUpTo } from "../helpers/utils";

describe("Feature: Moc Settlement block triggering", () => {
  let mocImpl: MocCARC20;
  before(async () => {
    const fixtureDeploy = fixtureDeployedMocRC20(2, undefined);
    ({ mocImpl } = await fixtureDeploy());
  });

  describe("GIVEN a MocCARC20 implementation deployed", () => {
    describe("WHEN settlement is executed before next block to settlement", () => {
      it("THEN tx reverts because block to settlement has not passed", async () => {
        await expect(mocImpl.execSettlement()).to.be.revertedWithCustomError(
          mocImpl,
          ERRORS.MISSING_BLOCKS_TO_SETTLEMENT,
        );
      });
    });

    describe("AND block to next settlement has passed", () => {
      before(async () => {
        await mineUpTo(await mocImpl.bns());
      });
      it("THEN blocks remaining to next settlement is 0", async () => {
        expect(await mocImpl.getBts()).to.be.equals(0);
      });
      describe("WHEN settlement is executed", () => {
        before(async () => {
          await mocImpl.execSettlement();
        });
        it("THEN blocks remaining for next settlement is equal to blocks between settlements", async () => {
          expect(await mocImpl.getBts()).to.be.equals(await mocImpl.bes());
        });
        describe("AND settlement is executed again", () => {
          it("THEN tx reverts because block to settlement has not passed", async () => {
            await expect(mocImpl.execSettlement()).to.be.revertedWithCustomError(
              mocImpl,
              ERRORS.MISSING_BLOCKS_TO_SETTLEMENT,
            );
          });
        });
      });
    });
  });
});
