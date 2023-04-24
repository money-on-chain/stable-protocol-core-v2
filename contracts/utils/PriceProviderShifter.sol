// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import { IPriceProvider } from "../interfaces/IPriceProvider.sol";

/**
  @title PriceProviderShifter
  @dev This simple contract, wraps a IPriceProvider and shift the returned price value in either direction.
  */
contract PriceProviderShifter is IPriceProvider {
    // The target price Provider
    IPriceProvider public immutable priceProvider;
    // The shift we want to apply, positive to multiply, negative to divide
    // Example: if "shift = 3", a 123000 value is converted to 123000000
    //          If "shift = -3", a 123000 is converted to 123
    int8 public immutable shift;

    /**
     * @notice constructor
     */
    constructor(IPriceProvider priceProvider_, int8 shift_) {
        priceProvider = priceProvider_;
        shift = shift_;
    }

    /**
     * @inheritdoc IPriceProvider
     */
    function peek() external view returns (bytes32 price, bool hasPrice) {
        (price, hasPrice) = priceProvider.peek();
        if (shift > 0) price = bytes32(uint256(price) * 10 ** uint8(shift));
        else if (shift < 0) price = bytes32(uint256(price) / 10 ** uint8(-shift));
    }
}
