// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../../core/MocCore.sol";

/**
 * @title MocCARBag: Moc Collateral Asset Bag
 * @notice Moc protocol implementation using a wrapping RC20 as Collateral Asset, which represents
 * the holdings of a collection of other RC20 Tokens.
 */
contract MocCARBag is MocCore {
    // Collateral Asset wrapped token
    MocRC20 private acToken;

    /**
     * @notice contract initializer
     * @dev this function must be execute by the AC implementation at initialization
     * @param acTokenAddress_ Collateral Asset token contract address
     * @param tcTokenAddress_ Collateral Token contract address
     * @param mocFeeFlowAddress_ Moc Fee Flow contract address
     * @param ctarg_ global target coverage of the model
     * @param protThrld_ protected state threshold
     * @param tcMintFee_ fee pct sent to Fee Flow for mint Collateral Tokens
     * @param tcRedeemFee_ fee pct sent to Fee Flow for redeem Collateral Tokens
     */
    function initialize(
        address acTokenAddress_,
        address tcTokenAddress_,
        address mocFeeFlowAddress_,
        uint256 ctarg_,
        uint256 protThrld_,
        uint256 tcMintFee_,
        uint256 tcRedeemFee_
    ) external initializer {
        if (acTokenAddress_ == address(0)) revert InvalidAddress();
        acToken = MocRC20(acTokenAddress_);
        _MocCore_init(tcTokenAddress_, mocFeeFlowAddress_, ctarg_, protThrld_, tcMintFee_, tcRedeemFee_);
    }

    /**
     * @notice transfer Collateral Asset
     * @param to_ address who receives the Collateral Asset
     * @param amount_ amount of Collateral Asset to transfer
     */
    function acTransfer(address to_, uint256 amount_) internal override {
        if (amount_ > 0) {
            bool success = acToken.transfer(to_, amount_);
            if (!success) revert TransferFail();
        }
    }
}
