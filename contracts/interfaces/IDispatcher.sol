// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

/**
 * @title IDispatcher
 * TODO: add doc
 */

// TODO: review contract name
interface IDispatcher {
    // TODO: add doc
    function getCombinedCglb(uint256 localCglb_) external view returns (uint256 combinedCglb);

    // TODO: add doc
    function getRealTCAvailableToRedeem(
        uint256 localTCAvailableToRedeem_
    ) external view returns (uint256 realTCAvailableToRedeem_);

    // TODO: add doc
    function getRealTPAvailableToMint(
        uint256 localTPAvailableToMint_
    ) external view returns (uint256 realTCAvailableToMint_);
}
