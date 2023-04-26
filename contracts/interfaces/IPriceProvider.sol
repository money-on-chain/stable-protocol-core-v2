// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

/**
 * @title IPriceFeed
 * @notice Amphiraos-Oracle Interface for peeking the price of a given asset
 * @dev https://github.com/money-on-chain/Amphiraos-Oracle
 */
interface IPriceProvider {
    /**
     * @notice returns the given `price` for the asset if `valid`
     * @param price assetPrice
     * @param valid true if the price is valid
     */
    function peek() external view returns (bytes32 price, bool valid);
}
