// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../../core/MocCore.sol";

/**
 * @title MocCACoinbase: Moc Collateral Asset Coinbase
 * @notice Moc protocol implementation using network Coinbase as Collateral Asset
 */
contract MocCACoinbase is MocCore {
    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param tcTokenAddress_ Collateral Token contract address
     * @param mocFeeFlowAddress_ Moc Fee Flow contract address
     * @param ctarg_ global target coverage of the model
     * @param protThrld_ protected state threshold
     * @param tcMintFee_ fee pct sent to Fee Flow for mint Collateral Tokens
     * @param tcRedeemFee_ fee pct sent to Fee Flow for redeem Collateral Tokens
     */
    function initialize(
        address tcTokenAddress_,
        address mocFeeFlowAddress_,
        uint256 ctarg_,
        uint256 protThrld_,
        uint256 tcMintFee_,
        uint256 tcRedeemFee_
    ) external initializer {
        _MocCore_init(tcTokenAddress_, mocFeeFlowAddress_, ctarg_, protThrld_, tcMintFee_, tcRedeemFee_);
    }

    // ------- Internal Functions -------

    /**
     * @notice transfer Collateral Asset
     * @param to_ address who receives the Collateral Asset
     * @param amount_ amount of Collateral Asset to transfer
     */
    function acTransfer(address to_, uint256 amount_) internal override {
        if (amount_ > 0) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, ) = to_.call{ value: amount_ }("");
            if (!success) revert TransferFail();
        }
    }

    // ------- External Functions -------

    /**
     * @notice caller sends Collateral Asset and receives Collateral Token
     * @param qTC_ amount of Collateral Token to mint
     */
    function mintTC(uint256 qTC_) external payable {
        _mintTCto(qTC_, msg.value, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends Collateral Asset and recipient address receives Collateral Token
     * @param qTC_ amount of Collateral Token to mint
     * @param recipient_ address who receives the Collateral Token
     */
    function mintTCTo(uint256 qTC_, address recipient_) external payable {
        _mintTCto(qTC_, msg.value, msg.sender, recipient_);
    }
}
