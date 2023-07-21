// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { MocCore } from "./MocCore.sol";

/**
 * @title MocCoreShared
 * @notice Extends MocCore, with redeem external shared redeem functions and definitions.
 * @dev This abstract contracts, is a just a middle step between MocCore and
 * RC20 and Coinbase implementation, as they share all redeem methods and events.
 */
abstract contract MocCoreShared is MocCore {
    // ------- Events -------
    event TCMinted(
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_
    );
    event TCRedeemed(
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_
    );
    event TPMinted(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_
    );
    event TPRedeemed(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_
    );
    event TCandTPRedeemed(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_
    );
    event TCandTPMinted(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_
    );
    event TPSwappedForTP(
        uint256 indexed iFrom_,
        uint256 iTo_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTPfrom_,
        uint256 qTPto_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_
    );
    event TPSwappedForTC(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qTC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_
    );
    event TCSwappedForTP(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_
    );

    // ------- External functions -------

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
        (qACRedeemed, qFeeToken, ) = _redeemTCto(params);
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
        (qACRedeemed, qFeeToken, ) = _redeemTCto(params);
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
        (qACRedeemed, qFeeToken, ) = _redeemTCto(params);
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
        (qACRedeemed, qFeeToken, ) = _redeemTCto(params);
    }

    /**
     * @notice hook after the TC is minted with operation information result
     * @param params_ mintTCto functions params
     * @param qACtotalNeeded_ amount of AC used to mint qTC
     * @param feeCalcs_ platform fee detail breakdown
     */
    function onTCMinted(
        MintTCParams memory params_,
        uint256 qACtotalNeeded_,
        FeeCalcs memory feeCalcs_
    ) internal override {
        emit TCMinted(
            params_.sender,
            params_.recipient,
            params_.qTC,
            qACtotalNeeded_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor
        );
    }

    /**
     * @notice hook after the TC is redeemed, with operation information result
     * @param params_ redeemTC functions params
     * @param qACRedeemed_ amount of AC redeemed
     * @param feeCalcs_ platform fee detail breakdown
     */
    function onTCRedeemed(
        RedeemTCParams memory params_,
        uint256 qACRedeemed_,
        FeeCalcs memory feeCalcs_
    ) internal override {
        emit TCRedeemed(
            params_.sender,
            params_.recipient,
            params_.qTC,
            qACRedeemed_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor
        );
    }

    /**
     * @notice hook after the TP is minted, with operation information result
     * @param params_ mintTP functions params
     * @param qACtotalNeeded_ amount of AC needed to mint qTP
     * @param feeCalcs_ platform fee detail breakdown
     */
    function onTPMinted(
        MintTPParams memory params_,
        uint256 qACtotalNeeded_,
        FeeCalcs memory feeCalcs_
    ) internal override {
        emit TPMinted(
            params_.i,
            params_.sender,
            params_.recipient,
            params_.qTP,
            qACtotalNeeded_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor
        );
    }

    /**
     * @notice Hook after the TP is redeemed, with operation information result
     * @param params_ redeemTPto function params
     * @param qACtoRedeem_ amount of AC to redeem
     * @param feeCalcs_ platform fee detail breakdown
     */
    function onTPRedeemed(
        RedeemTPParams memory params_,
        uint256 qACtoRedeem_,
        FeeCalcs memory feeCalcs_
    ) internal override {
        emit TPRedeemed(
            params_.i,
            params_.sender,
            params_.recipient,
            params_.qTP,
            qACtoRedeem_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor
        );
    }

    /**
     * @notice Hook after the TC and TP are minted, with operation information result
     * @param params_ mintTCandTPto function params
     * @param qTCMinted_ amount of qTC minted for the given qTP
     * @param qACtotalNeeded_ total amount of AC needed to mint qTC and qTP
     * @param feeCalcs_ platform fee detail breakdown
     */
    function onTCandTPMinted(
        MintTCandTPParams memory params_,
        uint256 qTCMinted_,
        uint256 qACtotalNeeded_,
        FeeCalcs memory feeCalcs_
    ) internal override {
        emit TCandTPMinted(
            params_.i,
            params_.sender,
            params_.recipient,
            qTCMinted_,
            params_.qTP,
            qACtotalNeeded_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor
        );
    }

    /**
     * @notice Hook after the TC and TP are redeemed, with operation information result
     * @param params_ redeemTCandTPto function params
     * @param qTPRedeemed_ total amount of TP redeemed
     * @param qACRedeemed_ total amount of AC redeemed
     * @param feeCalcs_ platform fee detail breakdown
     */
    function onTCandTPRedeemed(
        RedeemTCandTPParams memory params_,
        uint256 qTPRedeemed_,
        uint256 qACRedeemed_,
        FeeCalcs memory feeCalcs_
    ) internal override {
        emit TCandTPRedeemed(
            params_.i,
            params_.sender,
            params_.recipient,
            params_.qTC,
            qTPRedeemed_,
            qACRedeemed_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor
        );
    }

    /**
     * @notice Hook after the TC is swapped for TP, with operation information result
     * @param params_ swapTCforTP function params
     * @param qTPMinted_ total amount of TP minted
     * @param feeCalcs_ platform fee detail breakdown
     */
    function onTCSwappedForTP(
        SwapTCforTPParams memory params_,
        uint256 qTPMinted_,
        FeeCalcs memory feeCalcs_
    ) internal override {
        emit TCSwappedForTP(
            params_.i,
            params_.sender,
            params_.recipient,
            params_.qTC,
            qTPMinted_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor
        );
    }

    /**
     * @notice Hook after the TP is swapped for TC, with operation information result
     * @param params_ swapTPforTC function params
     * @param qTCMinted_ total amount of TC minted
     * @param feeCalcs_ platform fee detail breakdown
     */
    function onTPSwappedForTC(
        SwapTPforTCParams memory params_,
        uint256 qTCMinted_,
        FeeCalcs memory feeCalcs_
    ) internal override {
        emit TPSwappedForTC(
            params_.i,
            params_.sender,
            params_.recipient,
            params_.qTP,
            qTCMinted_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor
        );
    }

    /**
     * @notice Hook after the TP is swapped for another TP, with operation information result
     * @param params_ swapTPforTP function params
     * @param qTPMinted_ total amount of TP `iTo` minted
     * @param feeCalcs_ platform fee detail breakdown
     */
    function onTPSwappedForTP(
        SwapTPforTPParams memory params_,
        uint256 qTPMinted_,
        FeeCalcs memory feeCalcs_
    ) internal override {
        emit TPSwappedForTP(
            params_.iFrom,
            params_.iTo,
            params_.sender,
            params_.recipient,
            params_.qTP,
            qTPMinted_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor
        );
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
