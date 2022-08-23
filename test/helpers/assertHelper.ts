import { pEth } from "./utils";
import { expect } from "chai";
import { BigNumber } from "ethers";

export function assertPrec(
  expected: string | number | BigNumber,
  actual: string | number | BigNumber,
  tolerance = 100,
) {
  if (!BigNumber.isBigNumber(expected)) {
    expected = pEth(expected);
  }
  if (!BigNumber.isBigNumber(actual)) {
    actual = pEth(actual);
  }
  expect(expected).to.be.closeTo(actual, tolerance);
}
