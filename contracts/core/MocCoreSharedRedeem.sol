// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { MocCore } from "./MocCore.sol";

/**
 * @title MocCoreSharedRedeem
 * @notice Extends MocCore, with redeem external shared redeem functions.
 * @dev This abstract contracts, is a just a middle step between MocCore and
 * RC20 and Coinbase implementation, as they share all redeem methods.
 */
abstract contract MocCoreSharedRedeem is MocCore {
    /**
     * @notice caller sends Collateral Token and receives Collateral Asset
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @return qACRedeemed amount of AC sent to sender
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTC(uint256 qTC_, uint256 qACmin_) external payable returns (uint256 qACRedeemed, uint256 qFeeToken) {
        RedeemTCParams memory params = RedeemTCParams({
            qTC: qTC_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        return _redeemTCto(params);
    }

    /**
     * @notice caller sends Collateral Token and receives Collateral Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @param vendor_ address who receives a markup
     * @return qACRedeemed amount of AC sent to sender
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTCViaVendor(
        uint256 qTC_,
        uint256 qACmin_,
        address vendor_
    ) external payable returns (uint256 qACRedeemed, uint256 qFeeToken) {
        RedeemTCParams memory params = RedeemTCParams({
            qTC: qTC_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        return _redeemTCto(params);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Collateral Asset
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @return qACRedeemed amount of AC sent to 'recipient_'
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTCto(
        uint256 qTC_,
        uint256 qACmin_,
        address recipient_
    ) external payable returns (uint256 qACRedeemed, uint256 qFeeToken) {
        RedeemTCParams memory params = RedeemTCParams({
            qTC: qTC_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        return _redeemTCto(params);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Collateral Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @param vendor_ address who receives a markup
     * @return qACRedeemed amount of AC sent to 'recipient_'
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTCtoViaVendor(
        uint256 qTC_,
        uint256 qACmin_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 qACRedeemed, uint256 qFeeToken) {
        RedeemTCParams memory params = RedeemTCParams({
            qTC: qTC_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        return _redeemTCto(params);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
