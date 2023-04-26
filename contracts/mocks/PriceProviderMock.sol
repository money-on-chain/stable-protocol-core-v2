// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { IPriceProvider } from "../interfaces/IPriceProvider.sol";

contract PriceProviderMock is IPriceProvider {
    bytes32 public mocPrice;
    bool public has;

    /**
     * @notice constructor
     * @param price_ MoC price for mock contract
     */
    constructor(uint256 price_) {
        mocPrice = bytes32(price_);
        has = true;
    }

    function peek() external view returns (bytes32, bool) {
        return (mocPrice, has);
    }

    function poke(uint256 price_) external {
        mocPrice = bytes32(price_);
    }

    function deprecatePriceProvider() external {
        has = false;
    }
}
