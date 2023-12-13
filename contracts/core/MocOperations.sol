// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { MocCore } from "./MocCore.sol";
import { MocQueue } from "../queue/MocQueue.sol";
import { MocQueueExecFees } from "../queue/MocQueueExecFees.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

/**
 * @title MocOperations
 * @notice All the Moc Protocol operations are grouped in this contract
 */
abstract contract MocOperations is MocCore {
    // ------- Custom Errors -------
    error OnlyQueue();

    // ------- Modifiers -------
    modifier onlyMocQueue() {
        if (msg.sender != mocQueue) revert OnlyQueue();
        _;
    }

    /**
     * @notice get the amount of coinbase sent to be used as execution fee
     * @dev this function must be overridden by the AC implementation
     * @return qACmaxSent amount of coinbase sent
     * @return execFeeSent amount of coinbase sent
     */
    /* solhint-disable-next-line no-empty-blocks */
    function _getExecFeeSent(
        uint256 qACmax_,
        MocQueueExecFees.OperType operType_
    ) internal virtual returns (uint256 qACmaxSent, uint256 execFeeSent) {}

    /**
     * @notice while registering a pending Operation, we need to lock user's funds until it's executed
     * @param qACToLock_ AC amount to be locked
     */
    function _lockACInPending(uint256 qACToLock_) internal virtual {
        qACLockedInPending += qACToLock_;
    }

    /**
     * @notice while registering a pending Operation, we need to lock user's tokens until it's executed
     * @param qTCToLock_ TC amount to be locked
     */
    function _lockTCInPending(uint256 qTCToLock_) internal {
        SafeERC20Upgradeable.safeTransferFrom(tcToken, msg.sender, address(this), qTCToLock_);
    }

    /**
     * @notice while registering a pending Operation, we need to lock user's tokens until it's executed
     * @param qTPToLock_ TP amount to be locked
     */
    function _lockTPInPending(IERC20Upgradeable tpToken, uint256 qTPToLock_) internal {
        SafeERC20Upgradeable.safeTransferFrom(tpToken, msg.sender, address(this), qTPToLock_);
    }

    /**
     * @notice caller sends Collateral Asset and recipient receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *   Requires prior sender approval of Collateral Asset to this contract
     * @param qTC_ amount of Collateral Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param recipient_ address who receives the Collateral Token
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function _mintTCtoViaVendor(
        uint256 qTC_,
        uint256 qACmax_,
        address recipient_,
        address vendor_
    ) internal notLiquidated notPaused returns (uint256 operId) {
        (uint256 qACmax, uint256 execFee) = _getExecFeeSent(qACmax_, MocQueueExecFees.OperType.mintTC);
        MintTCParams memory params = MintTCParams({
            qTC: qTC_,
            qACmax: qACmax,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = MocQueue(mocQueue).queueMintTC{ value: execFee }(params);
        _lockACInPending(qACmax);
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
    function _redeemTCtoViaVendor(
        uint256 qTC_,
        uint256 qACmin_,
        address recipient_,
        address vendor_
    ) internal notLiquidated notPaused returns (uint256 operId) {
        RedeemTCParams memory params = RedeemTCParams({
            qTC: qTC_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = MocQueue(mocQueue).queueRedeemTC{ value: msg.value }(params);
        _lockTCInPending(qTC_);
    }

    /**
     * @notice caller sends Collateral Asset and recipient receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *   Requires prior sender approval of Collateral Asset to this contract
     * @param tp_ Pegged Token address to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param recipient_ address who receives the Pegged Token
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function _mintTPtoViaVendor(
        address tp_,
        uint256 qTP_,
        uint256 qACmax_,
        address recipient_,
        address vendor_
    ) internal notLiquidated notPaused returns (uint256 operId) {
        (uint256 qACmax, uint256 execFee) = _getExecFeeSent(qACmax_, MocQueueExecFees.OperType.mintTP);
        MintTPParams memory params = MintTPParams({
            tp: tp_,
            qTP: qTP_,
            qACmax: qACmax,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = MocQueue(mocQueue).queueMintTP{ value: execFee }(params);
        _lockACInPending(qACmax);
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
    function _redeemTPtoViaVendor(
        address tp_,
        uint256 qTP_,
        uint256 qACmin_,
        address recipient_,
        address vendor_
    ) internal notLiquidated notPaused returns (uint256 operId) {
        RedeemTPParams memory params = RedeemTPParams({
            tp: tp_,
            qTP: qTP_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = MocQueue(mocQueue).queueRedeemTP{ value: msg.value }(params);
        _lockTPInPending(IERC20Upgradeable(tp_), qTP_);
    }

    /**
     * @notice caller sends Collateral Asset and recipient receives Collateral Token and Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  Requires prior sender approval of Collateral Asset to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param tp_ Pegged Token address
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param recipient_ address who receives the Collateral Token and Pegged Token
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function _mintTCandTPtoViaVendor(
        address tp_,
        uint256 qTP_,
        uint256 qACmax_,
        address recipient_,
        address vendor_
    ) internal notLiquidated notPaused returns (uint256 operId) {
        (uint256 qACmax, uint256 execFee) = _getExecFeeSent(qACmax_, MocQueueExecFees.OperType.mintTCandTP);
        MintTCandTPParams memory params = MintTCandTPParams({
            tp: tp_,
            qTP: qTP_,
            qACmax: qACmax,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = MocQueue(mocQueue).queueMintTCandTP{ value: execFee }(params);
        _lockACInPending(qACmax);
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
    function _redeemTCandTPtoViaVendor(
        address tp_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACmin_,
        address recipient_,
        address vendor_
    ) internal notLiquidated notPaused returns (uint256 operId) {
        RedeemTCandTPParams memory params = RedeemTCandTPParams({
            tp: tp_,
            qTC: qTC_,
            qTP: qTP_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = MocQueue(mocQueue).queueRedeemTCandTP{ value: msg.value }(params);
        _lockTCInPending(qTC_);
        _lockTPInPending(IERC20Upgradeable(tp_), qTP_);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives another one
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tpFrom_ owned Pegged Token address
     * @param tpTo_ target Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @param recipient_ address who receives the target Pegged Token
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function _swapTPforTPtoViaVendor(
        address tpFrom_,
        address tpTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qACmax_,
        address recipient_,
        address vendor_
    ) internal notLiquidated notPaused returns (uint256 operId) {
        (uint256 qACmax, uint256 execFee) = _getExecFeeSent(qACmax_, MocQueueExecFees.OperType.swapTPforTP);
        SwapTPforTPParams memory params = SwapTPforTPParams({
            tpFrom: tpFrom_,
            tpTo: tpTo_,
            qTP: qTP_,
            qTPmin: qTPmin_,
            qACmax: qACmax,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = MocQueue(mocQueue).queueSwapTPforTP{ value: execFee }(params);
        _lockTPInPending(IERC20Upgradeable(tpFrom_), qTP_);
        _lockACInPending(qACmax);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tp_ Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @param recipient_ address who receives the Collateral Token
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function _swapTPforTCtoViaVendor(
        address tp_,
        uint256 qTP_,
        uint256 qTCmin_,
        uint256 qACmax_,
        address recipient_,
        address vendor_
    ) internal notLiquidated notPaused returns (uint256 operId) {
        (uint256 qACmax, uint256 execFee) = _getExecFeeSent(qACmax_, MocQueueExecFees.OperType.swapTPforTC);
        SwapTPforTCParams memory params = SwapTPforTCParams({
            tp: tp_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qACmax: qACmax,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = MocQueue(mocQueue).queueSwapTPforTC{ value: execFee }(params);
        _lockTPInPending(IERC20Upgradeable(tp_), qTP_);
        _lockACInPending(qACmax);
    }

    /**
     * @notice Caller sends a Collateral Token and recipient receives Pegged Token.
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not.
     * @param tp_ Pegged Token address
     * @param qTC_ Amount of owned Collateral Token to swap
     * @param qTPmin_ Minimum amount of Pegged Token that `recipient_` expects to receive
     * @param qACmax_ Maximum amount of Collateral Asset that can be spent in fees
     * @param recipient_ Address who receives the Pegged Token
     * @param vendor_ Address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function _swapTCforTPtoViaVendor(
        address tp_,
        uint256 qTC_,
        uint256 qTPmin_,
        uint256 qACmax_,
        address recipient_,
        address vendor_
    ) internal notLiquidated notPaused returns (uint256 operId) {
        (uint256 qACmax, uint256 execFee) = _getExecFeeSent(qACmax_, MocQueueExecFees.OperType.swapTCforTP);
        SwapTCforTPParams memory params = SwapTCforTPParams({
            tp: tp_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qACmax: qACmax,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = MocQueue(mocQueue).queueSwapTCforTP{ value: execFee }(params);
        _lockTCInPending(qTC_);
        _lockACInPending(qACmax);
    }

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

    // ------- External Only Queue Functions -------

    /**
     * @notice executes Operation based on params, only mocQueue allowed
     * see MocCore _mintTCto for details
     */
    function execMintTC(
        MintTCParams calldata params_
    ) external onlyMocQueue returns (uint256 qACtotalNeeded, uint256 qFeeTokenTotalNeeded, FeeCalcs memory feeCalcs) {
        return _mintTCto(params_);
    }

    /**
     * @notice executes Operation based on params, only mocQueue allowed
     * see MocCore _redeemTCto for details
     */
    function execRedeemTC(
        RedeemTCParams calldata params_
    ) external onlyMocQueue returns (uint256 qACtoRedeem, uint256 qFeeTokenTotalNeeded, FeeCalcs memory feeCalcs) {
        RedeemTCParams memory params = params_;
        // Override sender, as funds are now locked here
        return _redeemTCto(params);
    }

    /**
     * @notice executes Operation based on params, only mocQueue allowed
     * see MocCore _mintTPto for details
     */
    function execMintTP(
        MintTPParams calldata params_
    ) external onlyMocQueue returns (uint256 qACtotalNeeded, uint256 qFeeTokenTotalNeeded, FeeCalcs memory feeCalcs) {
        return _mintTPto(params_);
    }

    /**
     * @notice executes Operation based on params, only mocQueue allowed
     * see MocCore _redeemTPto for details
     */
    function execRedeemTP(
        RedeemTPParams calldata params_
    ) external onlyMocQueue returns (uint256 qACtoRedeem, uint256 qFeeTokenTotalNeeded, FeeCalcs memory feeCalcs) {
        return _redeemTPto(params_);
    }

    /**
     * @notice executes Operation based on params, only mocQueue allowed
     * see MocCore _mintTCandTPto for details
     */
    function execMintTCandTP(
        MintTCandTPParams calldata params_
    )
        external
        onlyMocQueue
        returns (uint256 qACtotalNeeded, uint256 qTCMinted, uint256 qFeeTokenTotalNeeded, FeeCalcs memory feeCalcs)
    {
        return _mintTCandTPto(params_);
    }

    /**
     * @notice executes Operation based on params, only mocQueue allowed
     * see MocCore _redeemTCandTPto for details
     */
    function execRedeemTCandTP(
        RedeemTCandTPParams calldata params_
    )
        external
        onlyMocQueue
        returns (uint256 qACtoRedeem, uint256 qTPRedeemed, uint256 qFeeTokenTotalNeeded, FeeCalcs memory feeCalcs)
    {
        (qACtoRedeem, qTPRedeemed, qFeeTokenTotalNeeded, feeCalcs) = _redeemTCandTPto(params_);
        // return the unused locked TPs
        unchecked {
            uint256 qTPDif = params_.qTP - qTPRedeemed;
            SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(params_.tp), params_.sender, qTPDif);
        }
    }

    /**
     * @notice executes Operation based on params, only mocQueue allowed
     * see MocCore _swapTCforTPto for details
     */
    function execSwapTCforTP(
        SwapTCforTPParams calldata params_
    )
        external
        onlyMocQueue
        returns (uint256 qACSurcharges, uint256 qTPMinted, uint256 qFeeTokenTotalNeeded, FeeCalcs memory feeCalcs)
    {
        return _swapTCforTPto(params_);
    }

    /**
     * @notice executes Operation based on params, only mocQueue allowed
     * see MocCore _swapTPforTCto for details
     */
    function execSwapTPforTC(
        SwapTPforTCParams calldata params_
    )
        external
        onlyMocQueue
        returns (uint256 qACSurcharges, uint256 qTCMinted, uint256 qFeeTokenTotalNeeded, FeeCalcs memory feeCalcs)
    {
        return _swapTPforTCto(params_);
    }

    /**
     * @notice executes Operation based on params, only mocQueue allowed
     * see MocCore _swapTPforTPto for details
     */
    function execSwapTPforTP(
        SwapTPforTPParams calldata params_
    )
        external
        onlyMocQueue
        returns (uint256 qACSurcharges, uint256 qTPMinted, uint256 qFeeTokenTotalNeeded, FeeCalcs memory feeCalcs)
    {
        return _swapTPforTPto(params_);
    }

    /**
     * @notice while executing a pending Operation, if it fails we need to unlock user's funds
     * @dev this function must be overridden by the AC implementation
     * @param owner_ funds owner, address to be returned to
     * @param qACToUnlock_ AC amount to be unlocked
     */
    function unlockACInPending(address owner_, uint256 qACToUnlock_) external virtual;

    /**
     * @notice while executing a pending Operation, if it fails we need to unlock user's tokens
     * @param owner_ funds owner, address to be returned to
     * @param qTCToUnlock_ TC amount to be unlocked
     */
    function unlockTCInPending(address owner_, uint256 qTCToUnlock_) external onlyMocQueue {
        SafeERC20Upgradeable.safeTransfer(tcToken, owner_, qTCToUnlock_);
    }

    /**
     * @notice while executing a pending Operation, if it fails we need to unlock user's tokens
     * @param owner_ funds owner, address to be returned to
     * @param tpToken_ TP to be unlocked
     * @param qTPToUnlock_ TP amount to be unlocked
     */
    function unlockTPInPending(address owner_, IERC20Upgradeable tpToken_, uint256 qTPToUnlock_) external onlyMocQueue {
        SafeERC20Upgradeable.safeTransfer(tpToken_, owner_, qTPToUnlock_);
    }
}
