// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { MocDeferred } from "./MocDeferred.sol";

/**
 * @title MocCoreShared
 * @notice Extends MocCore, with redeem external shared redeem functions and definitions.
 * @dev This abstract contracts, is a just a middle step between MocCore and
 * RC20 and Coinbase implementation, as they share all redeem methods and events.
 */
abstract contract MocCoreShared is MocDeferred {
    // ------- External functions -------

    /**
     * @notice caller sends Collateral Token and receives Collateral Asset
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTC(uint256 qTC_, uint256 qACmin_) external payable returns (uint256 operId) {
        return _redeemTCtoViaVendor(qTC_, qACmin_, msg.sender, address(0));
    }

    /**
     * @notice caller sends Collateral Token and receives Collateral Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTCViaVendor(
        uint256 qTC_,
        uint256 qACmin_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _redeemTCtoViaVendor(qTC_, qACmin_, msg.sender, vendor_);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Collateral Asset
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTCto(uint256 qTC_, uint256 qACmin_, address recipient_) external payable returns (uint256 operId) {
        return _redeemTCtoViaVendor(qTC_, qACmin_, recipient_, address(0));
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Collateral Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTCtoViaVendor(
        uint256 qTC_,
        uint256 qACmin_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _redeemTCtoViaVendor(qTC_, qACmin_, recipient_, vendor_);
    }

    /**
     * @notice caller sends Pegged Token and receives Collateral Asset
     * @param tp_ Pegged Token address to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTP(address tp_, uint256 qTP_, uint256 qACmin_) external payable returns (uint256 operId) {
        return _redeemTPtoViaVendor(tp_, qTP_, qACmin_, msg.sender, address(0));
    }

    /**
     * @notice caller sends Pegged Token and receives Collateral Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tp_ Pegged Token address to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTPViaVendor(
        address tp_,
        uint256 qTP_,
        uint256 qACmin_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _redeemTPtoViaVendor(tp_, qTP_, qACmin_, msg.sender, vendor_);
    }

    /**
     * @notice caller sends Pegged Token and recipient receives Collateral Asset
     * @param tp_ Pegged Token address to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTPto(
        address tp_,
        uint256 qTP_,
        uint256 qACmin_,
        address recipient_
    ) external payable returns (uint256 operId) {
        return _redeemTPtoViaVendor(tp_, qTP_, qACmin_, recipient_, address(0));
    }

    /**
     * @notice caller sends Pegged Token and recipient receives Collateral Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tp_ Pegged Token address to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTPtoViaVendor(
        address tp_,
        uint256 qTP_,
        uint256 qACmin_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _redeemTPtoViaVendor(tp_, qTP_, qACmin_, recipient_, vendor_);
    }

    /**
     * @notice Caller sends Collateral Token and Pegged Token and receives Collateral Asset.
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that their price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param tp_ Pegged Token address
     * @param qTC_ Maximum amount of Collateral Token to redeem
     * @param qTP_ Maximum amount of Pegged Token to redeem
     * @param qACmin_ Minimum amount of Collateral Asset that the sender expects to receive
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTCandTP(
        address tp_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACmin_
    ) external payable returns (uint256 operId) {
        return _redeemTCandTPtoViaVendor(tp_, qTC_, qTP_, qACmin_, msg.sender, address(0));
    }

    /**
     * @notice Caller sends Collateral Token and Pegged Token and receives Collateral Asset.
     *  `vendor_` receives a markup in Fee Token if possible or in Collateral Asset if not
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that their price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param tp_ Pegged Token address
     * @param qTC_ Maximum amount of Collateral Token to redeem
     * @param qTP_ Maximum amount of Pegged Token to redeem
     * @param qACmin_ Minimum amount of Collateral Asset that the sender expects to receive
     * @param vendor_ Address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTCandTPViaVendor(
        address tp_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACmin_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _redeemTCandTPtoViaVendor(tp_, qTC_, qTP_, qACmin_, msg.sender, vendor_);
    }

    /**
     * @notice Caller sends Collateral Token and Pegged Token and recipient receives Collateral Asset.
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that their price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param tp_ Pegged Token address
     * @param qTC_ Maximum amount of Collateral Token to redeem
     * @param qTP_ Maximum amount of Pegged Token to redeem
     * @param qACmin_ Minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ Address who receives the Collateral Asset
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTCandTPto(
        address tp_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACmin_,
        address recipient_
    ) external payable returns (uint256 operId) {
        return _redeemTCandTPtoViaVendor(tp_, qTC_, qTP_, qACmin_, recipient_, address(0));
    }

    /**
     * @notice Caller sends Collateral Token and Pegged Token and recipient receives Collateral Asset.
     *  `vendor_` receives a markup in Fee Token if possible or in Collateral Asset if not
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that their price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param tp_ Pegged Token address
     * @param qTC_ Maximum amount of Collateral Token to redeem
     * @param qTP_ Maximum amount of Pegged Token to redeem
     * @param qACmin_ Minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ Address who receives the Collateral Asset
     * @param vendor_ Address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTCandTPtoViaVendor(
        address tp_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACmin_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _redeemTCandTPtoViaVendor(tp_, qTC_, qTP_, qACmin_, recipient_, vendor_);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
