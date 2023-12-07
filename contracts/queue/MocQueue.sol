// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { MocQueueExecFees } from "./MocQueueExecFees.sol";
import { MocCore } from "../core/MocCore.sol";
import { MocCommons } from "../core/MocCommons.sol";
import { MocBaseBucket } from "../core/MocBaseBucket.sol";
import { MocOperations } from "../core/MocOperations.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
/* solhint-disable-next-line max-line-length */
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

bytes32 constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
bytes32 constant ENQUEUER_ROLE = keccak256("ENQUEUER_ROLE");

/**
 * @title MocQueue: Allows queue Operation deferral execution processing
 */
contract MocQueue is MocQueueExecFees, ReentrancyGuardUpgradeable {
    // ------- Custom Errors -------

    // Wrong amount of coinbase set as execution fee
    error BucketAlreadyRegistered();

    // ------- Events -------
    event OperationError(uint256 operId_, bytes4 errorCode_, string msg_);
    event UnhandledError(uint256 operId_, bytes reason_);

    event OperationQueued(address indexed bucket_, uint256 operId_, OperType operType_);
    event OperationExecuted(address indexed executor, uint256 indexed operId_);

    event TCMinted(
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_,
        uint256 operId_
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
        address vendor_,
        uint256 operId_
    );
    event TPMinted(
        address indexed tp,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_,
        uint256 operId_
    );
    event TPRedeemed(
        address indexed tp_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_,
        uint256 operId_
    );
    event TCandTPRedeemed(
        address indexed tp_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_,
        uint256 operId_
    );
    event TCandTPMinted(
        address indexed tp_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_,
        uint256 operId_
    );
    event TPSwappedForTP(
        address indexed tpFrom_,
        address tpTo_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTPfrom_,
        uint256 qTPto_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_,
        uint256 operId_
    );
    event TPSwappedForTC(
        address indexed tp_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qTC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_,
        uint256 operId_
    );
    event TCSwappedForTP(
        address indexed tp_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_,
        address vendor_,
        uint256 operId_
    );

    // ------- Structs -------
    struct OperInfo {
        // Operation Type
        OperType operType;
        // block number on which the Operation was queued
        uint248 queuedBlk;
    }

    // ------- Storage -------

    // mocOperations bucket that would be able to queue
    MocOperations public mocOperations;
    // Amount of Operations created
    uint256 public operIdCount;
    // first operation to be executed
    uint256 public firstOperId;

    mapping(uint256 => MocCore.MintTCParams) public operationsMintTC;
    mapping(uint256 => MocCore.MintTPParams) public operationsMintTP;
    mapping(uint256 => MocCore.RedeemTCParams) public operationsRedeemTC;
    mapping(uint256 => MocCore.RedeemTPParams) public operationsRedeemTP;
    mapping(uint256 => MocCore.MintTCandTPParams) public operationsMintTCandTP;
    mapping(uint256 => MocCore.RedeemTCandTPParams) public operationsRedeemTCandTP;
    mapping(uint256 => MocCore.SwapTCforTPParams) public operationsSwapTCforTP;
    mapping(uint256 => MocCore.SwapTPforTCParams) public operationsSwapTPforTC;
    mapping(uint256 => MocCore.SwapTPforTPParams) public operationsSwapTPforTP;

    // OperId => Operation Type | block.number
    mapping(uint256 => OperInfo) public opersInfo;

    // min amount of blocks the Operation should wait in the Queue before execution
    uint128 public minOperWaitingBlk;

    // max amount of Operations that can be executed on a single batch,
    // gas restricted batch size to guarantee no gas limit failure
    uint128 public maxOperPerBatch;

    // ------- Initializer -------

    function initialize(
        address governor_,
        address pauser_,
        uint128 minOperWaitingBlk_,
        uint128 maxOperPerBatch_,
        InitializeMocQueueExecFeesParams calldata mocQueueExecFeesParams_
    ) external initializer {
        __AccessControl_init();
        __MocUpgradable_init(governor_, pauser_);
        __MocQueueExecFees_init(mocQueueExecFeesParams_);
        __ReentrancyGuard_init();
        minOperWaitingBlk = minOperWaitingBlk_;
        maxOperPerBatch = maxOperPerBatch_;
    }

    // ------- Internal Functions -------

    /**
     * @notice hook after mintedTC Operation execution, emits the TCMinted event
     * @param operId_ Identifier to track the Operation lifecycle
     * @param params_ TCMint params
     * @param qACtotalNeeded_ amount of AC used to mint qTC
     * @param feeCalcs_ platform fee detail breakdown
     */
    function _onDeferredTCMinted(
        uint256 operId_,
        MocCore.MintTCParams memory params_,
        uint256 qACtotalNeeded_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
        emit TCMinted(
            params_.sender,
            params_.recipient,
            params_.qTC,
            qACtotalNeeded_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor,
            operId_
        );
    }

    /**
     * @notice hook after redeemTC Operation execution, emits the TCRedeemed event
     * @param operId_ Identifier to track the Operation lifecycle
     * @param params_ mintTCto function params
     * @param qACRedeemed_ amount of AC redeemed
     * @param feeCalcs_ platform fee detail breakdown
     */
    function _onDeferredTCRedeemed(
        uint256 operId_,
        MocCore.RedeemTCParams memory params_,
        uint256 qACRedeemed_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
        emit TCRedeemed(
            params_.sender,
            params_.recipient,
            params_.qTC,
            qACRedeemed_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor,
            operId_
        );
    }

    /**
     * @notice hook after mintTP Operation is executed, emits the TPMinted event
     * @param operId_ Identifier to track the Operation lifecycle
     * @param params_ mintTP functions params
     * @param qACtotalNeeded_ amount of AC needed to mint qTP
     * @param feeCalcs_ platform fee detail breakdown
     */
    function _onDeferredTPMinted(
        uint256 operId_,
        MocCore.MintTPParams memory params_,
        uint256 qACtotalNeeded_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
        emit TPMinted(
            params_.tp,
            params_.sender,
            params_.recipient,
            params_.qTP,
            qACtotalNeeded_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor,
            operId_
        );
    }

    /**
     * @notice Hook after the TP is redeemed, with operation information result
     * @param operId_ operation id
     * @param params_ redeemTPto function params
     * @param qACRedeemed_ amount of AC redeemed
     * @param feeCalcs_ platform fee detail breakdown
     */
    function _onDeferredTPRedeemed(
        uint256 operId_,
        MocCore.RedeemTPParams memory params_,
        uint256 qACRedeemed_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
        emit TPRedeemed(
            params_.tp,
            params_.sender,
            params_.recipient,
            params_.qTP,
            qACRedeemed_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor,
            operId_
        );
    }

    /**
     * @notice Hook after the TC and TP are minted, with operation information result
     * @param operId_ operation id
     * @param params_ mintTCandTPto function params
     * @param qTCMinted_ amount of qTC minted for the given qTP
     * @param qACtotalNeeded_ total amount of AC needed to mint qTC and qTP
     * @param feeCalcs_ platform fee detail breakdown
     */
    function _onDeferredTCandTPMinted(
        uint256 operId_,
        MocCore.MintTCandTPParams memory params_,
        uint256 qTCMinted_,
        uint256 qACtotalNeeded_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
        emit TCandTPMinted(
            params_.tp,
            params_.sender,
            params_.recipient,
            qTCMinted_,
            params_.qTP,
            qACtotalNeeded_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor,
            operId_
        );
    }

    /**
     * @notice Hook after the TC and TP are redeemed, with operation information result
     * @param operId_ operation id
     * @param params_ redeemTCandTPto function params
     * @param qTPRedeemed_ total amount of TP redeemed
     * @param qACRedeemed_ total amount of AC redeemed
     * @param feeCalcs_ platform fee detail breakdown
     */
    function _onDeferredTCandTPRedeemed(
        uint256 operId_,
        MocCore.RedeemTCandTPParams memory params_,
        uint256 qTPRedeemed_,
        uint256 qACRedeemed_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
        emit TCandTPRedeemed(
            params_.tp,
            params_.sender,
            params_.recipient,
            params_.qTC,
            qTPRedeemed_,
            qACRedeemed_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor,
            operId_
        );
    }

    /**
     * @notice Hook after the TC is swapped for TP, with operation information result
     * @param operId_ operation id
     * @param params_ swapTCforTP function params
     * @param qTPMinted_ total amount of TP swapped
     * @param feeCalcs_ platform fee detail breakdown
     */
    function _onDeferredTCforTPSwapped(
        uint256 operId_,
        MocCore.SwapTCforTPParams memory params_,
        uint256 qTPMinted_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
        emit TCSwappedForTP(
            params_.tp,
            params_.sender,
            params_.recipient,
            params_.qTC,
            qTPMinted_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor,
            operId_
        );
    }

    /**
     * @notice Hook after the TP is swapped for TC, with operation information result
     * @param operId_ operation id
     * @param params_ swapTPforTC function params
     * @param qTCMinted_ total amount of TC minted
     * @param feeCalcs_ platform fee detail breakdown
     */
    function _onDeferredTPforTCSwapped(
        uint256 operId_,
        MocCore.SwapTPforTCParams memory params_,
        uint256 qTCMinted_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
        emit TPSwappedForTC(
            params_.tp,
            params_.sender,
            params_.recipient,
            params_.qTP,
            qTCMinted_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor,
            operId_
        );
    }

    /**
     * @notice Hook after the TP is swapped for another TP, with operation information result
     * @param operId_ operation id
     * @param params_ swapTPforTP function params
     * @param qTPMinted_ total amount of TP `iTo` minted
     * @param feeCalcs_ platform fee detail breakdown
     */
    function _onDeferredTPforTPSwapped(
        uint256 operId_,
        MocCore.SwapTPforTPParams memory params_,
        uint256 qTPMinted_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
        emit TPSwappedForTP(
            params_.tpFrom,
            params_.tpTo,
            params_.sender,
            params_.recipient,
            params_.qTP,
            qTPMinted_,
            feeCalcs_.qACFee,
            feeCalcs_.qFeeToken,
            feeCalcs_.qACVendorMarkup,
            feeCalcs_.qFeeTokenVendorMarkup,
            params_.vendor,
            operId_
        );
    }

    /**
     * @notice Executes mint TC handling any error
     * @param operId_ operation id
     * @return executed true if the Operations was executed
     *
     * May emit {TCMinted, OperationError, UnhandledError} events
     */
    function _executeMintTC(uint256 operId_) internal virtual returns (bool executed) {
        MocCore.MintTCParams memory params = operationsMintTC[operId_];
        try mocOperations.execMintTC(params) returns (
            uint256 _qACtotalNeeded,
            uint256,
            MocCore.FeeCalcs memory _feeCalcs
        ) {
            _onDeferredTCMinted(operId_, params, _qACtotalNeeded, _feeCalcs);
        } catch (bytes memory returnData) {
            // TODO: analyze if it's necessary to decode error params, returnData needs to be
            // padded/shifted as decode only takes bytes32 chunks and error selector is just 4 bytes.
            bytes4 errorSelector = bytes4(returnData);
            if (errorSelector == MocCommons.InsufficientQacSent.selector) {
                emit OperationError(operId_, errorSelector, "Insufficient qac sent");
            } else if (errorSelector == MocBaseBucket.LowCoverage.selector) {
                emit OperationError(operId_, errorSelector, "Low coverage");
            } else emit UnhandledError(operId_, returnData);

            // On a failed Operation, we unlock user funds
            mocOperations.unlockACInPending(params.sender, params.qACmax);
        }
        // Independently from the result, we delete the operation params
        delete operationsMintTC[operId_];
        return true;
    }

    /**
     * @notice Executes redeem TC handling any error
     * @param operId_ operation id
     * @return executed true if the Operations was executed
     *
     * May emit {TCRedeemed, OperationError, UnhandledError} events
     */
    function _executeRedeemTC(uint256 operId_) internal virtual returns (bool executed) {
        MocCore.RedeemTCParams memory params = operationsRedeemTC[operId_];
        try mocOperations.execRedeemTC(params) returns (
            uint256 _qACRedeemed,
            uint256,
            MocCore.FeeCalcs memory _feeCalcs
        ) {
            _onDeferredTCRedeemed(operId_, params, _qACRedeemed, _feeCalcs);
        } catch (bytes memory returnData) {
            // TODO: analyze if it's necessary to decode error params, returnData needs to be
            // padded/shifted as decode only takes bytes32 chunks and error selector is just 4 bytes.
            bytes4 errorSelector = bytes4(returnData);
            if (errorSelector == MocCommons.InsufficientTCtoRedeem.selector) {
                emit OperationError(operId_, errorSelector, "Insufficient tc to redeem");
            } else if (errorSelector == MocCommons.QacBelowMinimumRequired.selector) {
                emit OperationError(operId_, errorSelector, "qAC below minimum required");
            } else if (errorSelector == MocBaseBucket.LowCoverage.selector) {
                emit OperationError(operId_, errorSelector, "Low coverage");
            } else emit UnhandledError(operId_, returnData);

            // On a failed Operation, we unlock user funds
            mocOperations.unlockTCInPending(params.sender, params.qTC);
        }
        // Independently from the result, we delete the operation params
        delete operationsRedeemTC[operId_];
        return true;
    }

    /**
     * @notice Executes mint TP handling any error
     * @param operId_ operation id
     * @return executed true if the Operations was executed
     *
     * May emit {TPMinted, OperationError, UnhandledError} events
     */
    function _executeMintTP(uint256 operId_) internal virtual returns (bool executed) {
        MocCore.MintTPParams memory params = operationsMintTP[operId_];
        try mocOperations.execMintTP(params) returns (
            uint256 _qACtotalNeeded,
            uint256,
            MocCore.FeeCalcs memory _feeCalcs
        ) {
            _onDeferredTPMinted(operId_, params, _qACtotalNeeded, _feeCalcs);
        } catch (bytes memory returnData) {
            // TODO: analyze if it's necessary to decode error params, returnData needs to be
            // padded/shifted as decode only takes bytes32 chunks and error selector is just 4 bytes.
            bytes4 errorSelector = bytes4(returnData);
            if (errorSelector == MocCommons.MaxFluxCapacitorOperationReached.selector) {
                // this error is handled to stop the batch execution, so the operation can be executed again
                // after blocks pass and the flux capacitor is free again
                emit OperationError(operId_, errorSelector, "Max flux capacitor operation reached");
                return false;
            } else if (errorSelector == MocCommons.InsufficientTPtoMint.selector) {
                emit OperationError(operId_, errorSelector, "Insufficient tp to mint");
            } else if (errorSelector == MocCommons.InsufficientQacSent.selector) {
                emit OperationError(operId_, errorSelector, "Insufficient qac sent");
            } else if (errorSelector == MocBaseBucket.LowCoverage.selector) {
                emit OperationError(operId_, errorSelector, "Low coverage");
            } else emit UnhandledError(operId_, returnData);

            // On a failed Operation, we unlock user funds
            mocOperations.unlockACInPending(params.sender, params.qACmax);
        }
        // Independently from the result, we delete the operation params
        delete operationsMintTP[operId_];
        return true;
    }

    /**
     * @notice Executes redeem TP handling any error
     * @param operId_ operation id
     * @return executed true if the Operations was executed
     *
     * May emit {TPRedeemed, OperationError, UnhandledError} events
     */
    function _executeRedeemTP(uint256 operId_) internal virtual returns (bool executed) {
        MocCore.RedeemTPParams memory params = operationsRedeemTP[operId_];
        try mocOperations.execRedeemTP(params) returns (
            uint256 _qACRedeemed,
            uint256,
            MocCore.FeeCalcs memory _feeCalcs
        ) {
            _onDeferredTPRedeemed(operId_, params, _qACRedeemed, _feeCalcs);
        } catch (bytes memory returnData) {
            // TODO: analyze if it's necessary to decode error params, returnData needs to be
            // padded/shifted as decode only takes bytes32 chunks and error selector is just 4 bytes.
            bytes4 errorSelector = bytes4(returnData);
            if (errorSelector == MocCommons.MaxFluxCapacitorOperationReached.selector) {
                // this error is handled to stop the batch execution, so the operation can be executed again
                // after blocks pass and the flux capacitor is free again
                emit OperationError(operId_, errorSelector, "Max flux capacitor operation reached");
                return false;
            } else if (errorSelector == MocCommons.QacBelowMinimumRequired.selector) {
                emit OperationError(operId_, errorSelector, "qAC below minimum required");
            } else if (errorSelector == MocBaseBucket.LowCoverage.selector) {
                emit OperationError(operId_, errorSelector, "Low coverage");
            } else emit UnhandledError(operId_, returnData);

            // On a failed Operation, we unlock user funds
            mocOperations.unlockTPInPending(params.sender, IERC20Upgradeable(params.tp), params.qTP);
        }
        // Independently from the result, we delete the operation params
        delete operationsRedeemTP[operId_];
        return true;
    }

    /**
     * @notice Executes mint TC and TP handling any error
     * @param operId_ operation id
     * @return executed true if the Operations was executed
     *
     * May emit {TCandTPMinted, OperationError, UnhandledError} events
     */
    function _executeMintTCandTP(uint256 operId_) internal virtual returns (bool executed) {
        MocCore.MintTCandTPParams memory params = operationsMintTCandTP[operId_];
        try mocOperations.execMintTCandTP(params) returns (
            uint256 _qACtotalNeeded,
            uint256 _qTcMinted,
            uint256,
            MocCore.FeeCalcs memory _feeCalcs
        ) {
            _onDeferredTCandTPMinted(operId_, params, _qTcMinted, _qACtotalNeeded, _feeCalcs);
        } catch (bytes memory returnData) {
            // TODO: analyze if it's necessary to decode error params, returnData needs to be
            // padded/shifted as decode only takes bytes32 chunks and error selector is just 4 bytes.
            bytes4 errorSelector = bytes4(returnData);
            if (errorSelector == MocCommons.MaxFluxCapacitorOperationReached.selector) {
                // this error is handled to stop the batch execution, so the operation can be executed again
                // after blocks pass and the flux capacitor is free again
                emit OperationError(operId_, errorSelector, "Max flux capacitor operation reached");
                return false;
            } else if (errorSelector == MocCommons.InsufficientQacSent.selector) {
                emit OperationError(operId_, errorSelector, "Insufficient qac sent");
            } else if (errorSelector == MocBaseBucket.LowCoverage.selector) {
                emit OperationError(operId_, errorSelector, "Low coverage");
            } else emit UnhandledError(operId_, returnData);

            // On a failed Operation, we unlock user funds
            mocOperations.unlockACInPending(params.sender, params.qACmax);
        }
        // Independently from the result, we delete the operation params
        delete operationsMintTCandTP[operId_];
        return true;
    }

    /**
     * @notice Executes redeem TC and TP handling any error
     * @param operId_ operation id
     * @return executed true if the Operations was executed
     *
     * May emit {TCandTPRedeemed, OperationError, UnhandledError} events
     */
    function _executeRedeemTCandTP(uint256 operId_) internal virtual returns (bool executed) {
        MocCore.RedeemTCandTPParams memory params = operationsRedeemTCandTP[operId_];
        try mocOperations.execRedeemTCandTP(params) returns (
            uint256 _qACRedeemed,
            uint256 _qTPRedeemed,
            uint256,
            MocCore.FeeCalcs memory _feeCalcs
        ) {
            _onDeferredTCandTPRedeemed(operId_, params, _qTPRedeemed, _qACRedeemed, _feeCalcs);
        } catch (bytes memory returnData) {
            // TODO: analyze if it's necessary to decode error params, returnData needs to be
            // padded/shifted as decode only takes bytes32 chunks and error selector is just 4 bytes.
            bytes4 errorSelector = bytes4(returnData);
            if (errorSelector == MocCommons.MaxFluxCapacitorOperationReached.selector) {
                // this error is handled to stop the batch execution, so the operation can be executed again
                // after blocks pass and the flux capacitor is free again
                emit OperationError(operId_, errorSelector, "Max flux capacitor operation reached");
                return false;
            } else if (errorSelector == MocCommons.InsufficientQtpSent.selector) {
                emit OperationError(operId_, errorSelector, "Insufficient tp sent");
            } else if (errorSelector == MocCommons.QacBelowMinimumRequired.selector) {
                emit OperationError(operId_, errorSelector, "qAC below minimum required");
            } else if (errorSelector == MocBaseBucket.LowCoverage.selector) {
                emit OperationError(operId_, errorSelector, "Low coverage");
            } else emit UnhandledError(operId_, returnData);

            // On a failed Operation, we unlock user funds
            mocOperations.unlockTPInPending(params.sender, IERC20Upgradeable(params.tp), params.qTP);
            mocOperations.unlockTCInPending(params.sender, params.qTC);
        }
        // Independently from the result, we delete the operation params
        delete operationsRedeemTCandTP[operId_];
        return true;
    }

    /**
     * @notice Executes swap TC for TP handling any error
     * @param operId_ operation id
     * @return executed true if the Operations was executed
     *
     * May emit {TCforTPSwapped, OperationError, UnhandledError} events
     */
    function _executeSwapTCforTP(uint256 operId_) internal virtual returns (bool executed) {
        MocCore.SwapTCforTPParams memory params = operationsSwapTCforTP[operId_];
        try mocOperations.execSwapTCforTP(params) returns (
            uint256,
            uint256 qTPMinted,
            uint256,
            MocCore.FeeCalcs memory feeCalcs
        ) {
            _onDeferredTCforTPSwapped(operId_, params, qTPMinted, feeCalcs);
        } catch (bytes memory returnData) {
            // TODO: analyze if it's necessary to decode error params, returnData needs to be
            // padded/shifted as decode only takes bytes32 chunks and error selector is just 4 bytes.
            bytes4 errorSelector = bytes4(returnData);
            if (errorSelector == MocCommons.MaxFluxCapacitorOperationReached.selector) {
                // this error is handled to stop the batch execution, so the operation can be executed again
                // after blocks pass and the flux capacitor is free again
                emit OperationError(operId_, errorSelector, "Max flux capacitor operation reached");
                return false;
            } else if (errorSelector == MocCommons.InsufficientQacSent.selector) {
                emit OperationError(operId_, errorSelector, "Insufficient qac sent");
            } else if (errorSelector == MocCommons.QtpBelowMinimumRequired.selector) {
                emit OperationError(operId_, errorSelector, "qTp below minimum required");
            } else if (errorSelector == MocBaseBucket.LowCoverage.selector) {
                emit OperationError(operId_, errorSelector, "Low coverage");
            } else emit UnhandledError(operId_, returnData);

            // On a failed Operation, we unlock user funds
            mocOperations.unlockTCInPending(params.sender, params.qTC);
            mocOperations.unlockACInPending(params.sender, params.qACmax);
        }
        // Independently from the result, we delete the operation params
        delete operationsSwapTCforTP[operId_];
        return true;
    }

    /**
     * @notice Executes swap TP for TC handling any error
     * @param operId_ operation id
     * @return executed true if the Operations was executed
     *
     * May emit {TPforTCSwapped, OperationError, UnhandledError} events
     */
    function _executeSwapTPforTC(uint256 operId_) internal virtual returns (bool executed) {
        MocCore.SwapTPforTCParams memory params = operationsSwapTPforTC[operId_];
        try mocOperations.execSwapTPforTC(params) returns (
            uint256,
            uint256 qTCMinted,
            uint256,
            MocCore.FeeCalcs memory feeCalcs
        ) {
            _onDeferredTPforTCSwapped(operId_, params, qTCMinted, feeCalcs);
        } catch (bytes memory returnData) {
            // TODO: analyze if it's necessary to decode error params, returnData needs to be
            // padded/shifted as decode only takes bytes32 chunks and error selector is just 4 bytes.
            bytes4 errorSelector = bytes4(returnData);
            if (errorSelector == MocCommons.MaxFluxCapacitorOperationReached.selector) {
                // this error is handled to stop the batch execution, so the operation can be executed again
                // after blocks pass and the flux capacitor is free again
                emit OperationError(operId_, errorSelector, "Max flux capacitor operation reached");
                return false;
            } else if (errorSelector == MocCommons.InsufficientQacSent.selector) {
                emit OperationError(operId_, errorSelector, "Insufficient qac sent");
            } else if (errorSelector == MocCommons.QtcBelowMinimumRequired.selector) {
                emit OperationError(operId_, errorSelector, "qTc below minimum required");
            } else if (errorSelector == MocBaseBucket.LowCoverage.selector) {
                emit OperationError(operId_, errorSelector, "Low coverage");
            } else emit UnhandledError(operId_, returnData);

            // On a failed Operation, we unlock user funds
            mocOperations.unlockTPInPending(params.sender, IERC20Upgradeable(params.tp), params.qTP);
            mocOperations.unlockACInPending(params.sender, params.qACmax);
        }
        // Independently from the result, we delete the operation params
        delete operationsSwapTPforTC[operId_];
        return true;
    }

    /**
     * @notice Executes swap TP for TP handling any error
     * @param operId_ operation id
     * @return executed true if the Operations was executed
     *
     * May emit {TPforTPSwapped, OperationError, UnhandledError} events
     */
    function _executeSwapTPforTP(uint256 operId_) internal virtual returns (bool executed) {
        MocCore.SwapTPforTPParams memory params = operationsSwapTPforTP[operId_];
        // Independently from the result, we delete the operation params
        delete operationsSwapTPforTP[operId_];
        try mocOperations.execSwapTPforTP(params) returns (
            uint256,
            uint256 qTPMinted,
            uint256,
            MocCore.FeeCalcs memory feeCalcs
        ) {
            _onDeferredTPforTPSwapped(operId_, params, qTPMinted, feeCalcs);
        } catch (bytes memory returnData) {
            // TODO: analyze if it's necessary to decode error params, returnData needs to be
            // padded/shifted as decode only takes bytes32 chunks and error selector is just 4 bytes.
            bytes4 errorSelector = bytes4(returnData);
            if (errorSelector == MocCommons.InsufficientQacSent.selector) {
                emit OperationError(operId_, errorSelector, "Insufficient qac sent");
            } else if (errorSelector == MocCommons.QtpBelowMinimumRequired.selector) {
                emit OperationError(operId_, errorSelector, "qTp below minimum required");
            } else if (errorSelector == MocBaseBucket.LowCoverage.selector) {
                emit OperationError(operId_, errorSelector, "Low coverage");
            } else emit UnhandledError(operId_, returnData);

            // On a failed Operation, we unlock user funds
            mocOperations.unlockTPInPending(params.sender, IERC20Upgradeable(params.tpFrom), params.qTP);
            mocOperations.unlockACInPending(params.sender, params.qACmax);
        }
        return true;
    }

    /**
     * @notice executes the given Operation by the `operId_`
     * @dev does not revert on Operation failure, throws Process and Error
     * events according to the Oper type and result
     * @param operId_ Identifier for the Operation to be executed
     * @return executed true if the Operations was executed
     * @return executionFee execution fees corresponding to this Operation
     */
    function execute(uint256 operId_, uint256 limitBlk) internal returns (bool executed, uint256 executionFee) {
        OperInfo memory operInfo = opersInfo[operId_];
        if (operInfo.queuedBlk > limitBlk) {
            executed = false;
            executionFee = 0;
        } else if (operInfo.operType == OperType.mintTC) {
            executed = _executeMintTC(operId_);
            executionFee = execFee[OperType.mintTC];
        } else if (operInfo.operType == OperType.redeemTC) {
            executed = _executeRedeemTC(operId_);
            executionFee = execFee[OperType.redeemTC];
        } else if (operInfo.operType == OperType.mintTP) {
            executed = _executeMintTP(operId_);
            executionFee = execFee[OperType.mintTP];
        } else if (operInfo.operType == OperType.redeemTP) {
            executed = _executeRedeemTP(operId_);
            executionFee = execFee[OperType.redeemTP];
        } else if (operInfo.operType == OperType.mintTCandTP) {
            executed = _executeMintTCandTP(operId_);
            executionFee = execFee[OperType.mintTCandTP];
        } else if (operInfo.operType == OperType.redeemTCandTP) {
            executed = _executeRedeemTCandTP(operId_);
            executionFee = execFee[OperType.redeemTCandTP];
        } else if (operInfo.operType == OperType.swapTCforTP) {
            executed = _executeSwapTCforTP(operId_);
            executionFee = execFee[OperType.swapTCforTP];
        } else if (operInfo.operType == OperType.swapTPforTC) {
            executed = _executeSwapTPforTC(operId_);
            executionFee = execFee[OperType.swapTPforTC];
        } else if (operInfo.operType == OperType.swapTPforTP) {
            executed = _executeSwapTPforTP(operId_);
            executionFee = execFee[OperType.swapTPforTP];
        }
        if (executed) delete opersInfo[operId_];
        return (executed, executionFee);
    }

    // ------- External Functions -------

    /**
     * @notice registered executors can process Operations in the queue
     * @dev does not revert on Operation failure, throws Process and Error
     * events according to the Oper type and result
     */
    function execute(address executionFeeRecipient) external notPaused nonReentrant onlyRole(EXECUTOR_ROLE) {
        uint256 operId = firstOperId;
        uint256 lastOperId;
        uint256 limitBlk;
        uint256 totalExecutionFee;
        unchecked {
            lastOperId = Math.min(operIdCount, operId + maxOperPerBatch);
            limitBlk = block.number - minOperWaitingBlk;
        }
        // loop through all pending Operations
        while (operId < lastOperId) {
            (bool executed, uint256 executionFee) = execute(operId, limitBlk);
            if (executed) {
                emit OperationExecuted(msg.sender, operId);
                operId = unchecked_inc(operId);
                unchecked {
                    totalExecutionFee += executionFee;
                }
            } else {
                break;
            }
        }
        // Define new reference to queue beginning
        firstOperId = operId;
        if (totalExecutionFee > 0) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, ) = executionFeeRecipient.call{ value: totalExecutionFee }("");
            if (!success) revert ExecutionFeePaymentFailed();
        }
    }

    /**
     * @notice registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueMintTC(
        MocCore.MintTCParams calldata params
    ) external payable notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        verifyExecFee(execFee[OperType.mintTC]);
        operId = operIdCount;
        opersInfo[operId] = OperInfo(OperType.mintTC, uint248(block.number));
        operationsMintTC[operId] = params;
        emit OperationQueued(msg.sender, operId, OperType.mintTC);
        operIdCount++;
    }

    /**
     * @notice registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueRedeemTC(
        MocCore.RedeemTCParams calldata params
    ) external payable notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        verifyExecFee(execFee[OperType.redeemTC]);
        operId = operIdCount;
        opersInfo[operId] = OperInfo(OperType.redeemTC, uint248(block.number));
        operationsRedeemTC[operId] = params;
        emit OperationQueued(msg.sender, operId, OperType.redeemTC);
        operIdCount++;
    }

    /**
     * @notice registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueMintTP(
        MocCore.MintTPParams calldata params
    ) external payable notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        verifyExecFee(execFee[OperType.mintTP]);
        operId = operIdCount;
        opersInfo[operId] = OperInfo(OperType.mintTP, uint248(block.number));
        operationsMintTP[operId] = params;
        emit OperationQueued(msg.sender, operId, OperType.mintTP);
        operIdCount++;
    }

    /**
     * @notice Registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueRedeemTP(
        MocCore.RedeemTPParams calldata params
    ) external payable notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        verifyExecFee(execFee[OperType.redeemTP]);
        operId = operIdCount;
        opersInfo[operId] = OperInfo(OperType.redeemTP, uint248(block.number));
        operationsRedeemTP[operId] = params;
        emit OperationQueued(msg.sender, operId, OperType.redeemTP);
        operIdCount++;
    }

    /**
     * @notice Registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueMintTCandTP(
        MocCore.MintTCandTPParams calldata params
    ) external payable notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        verifyExecFee(execFee[OperType.mintTCandTP]);
        operId = operIdCount;
        opersInfo[operId] = OperInfo(OperType.mintTCandTP, uint248(block.number));
        operationsMintTCandTP[operId] = params;
        emit OperationQueued(msg.sender, operId, OperType.mintTCandTP);
        operIdCount++;
    }

    /**
     * @notice Registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueRedeemTCandTP(
        MocCore.RedeemTCandTPParams calldata params
    ) external payable notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        verifyExecFee(execFee[OperType.redeemTCandTP]);
        operId = operIdCount;
        opersInfo[operId] = OperInfo(OperType.redeemTCandTP, uint248(block.number));
        operationsRedeemTCandTP[operId] = params;
        emit OperationQueued(msg.sender, operId, OperType.redeemTCandTP);
        operIdCount++;
    }

    /**
     * @notice Registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueSwapTCforTP(
        MocCore.SwapTCforTPParams calldata params
    ) external payable notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        verifyExecFee(execFee[OperType.swapTCforTP]);
        operId = operIdCount;
        opersInfo[operId] = OperInfo(OperType.swapTCforTP, uint248(block.number));
        operationsSwapTCforTP[operId] = params;
        emit OperationQueued(msg.sender, operId, OperType.swapTCforTP);
        operIdCount++;
    }

    /**
     * @notice Registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueSwapTPforTC(
        MocCore.SwapTPforTCParams calldata params
    ) external payable notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        verifyExecFee(execFee[OperType.swapTPforTC]);
        operId = operIdCount;
        opersInfo[operId] = OperInfo(OperType.swapTPforTC, uint248(block.number));
        operationsSwapTPforTC[operId] = params;
        emit OperationQueued(msg.sender, operId, OperType.swapTPforTC);
        operIdCount++;
    }

    /**
     * @notice Registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueSwapTPforTP(
        MocCore.SwapTPforTPParams calldata params
    ) external payable notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        verifyExecFee(execFee[OperType.swapTPforTP]);
        operId = operIdCount;
        opersInfo[operId] = OperInfo(OperType.swapTPforTP, uint248(block.number));
        operationsSwapTPforTP[operId] = params;
        emit OperationQueued(msg.sender, operId, OperType.swapTPforTP);
        operIdCount++;
    }

    /**
     * @notice true if the queue is empty
     */
    function isEmpty() public view override returns (bool) {
        return firstOperId == operIdCount;
    }

    /**
     * @notice true if the queue has at least one Operation ready to be executed
     */
    function readyToExecute() public view returns (bool) {
        if (isEmpty()) return false;
        OperInfo memory operInfo = opersInfo[firstOperId];
        return (operInfo.queuedBlk <= block.number - minOperWaitingBlk);
    }

    // ------- Only Authorized Changer Functions -------

    /**
     * @notice sets Moc Queue minimum operation waiting blocks
     * @param minOperWaitingBlk_ minimum amount of blocks an operation needs to remain in the
     * queue before it can be executed
     */
    function setMinOperWaitingBlk(uint128 minOperWaitingBlk_) external onlyAuthorizedChanger {
        minOperWaitingBlk = minOperWaitingBlk_;
    }

    /**
     * @notice sets Moc Queue maximum amount of operations per execution batch
     * @param maxOperPerBatch_ maximum amount of operations allowed on a batch to avoid going over
     * the block gas limit
     */
    function setMaxOperPerBatch(uint128 maxOperPerBatch_) external onlyAuthorizedChanger {
        maxOperPerBatch = maxOperPerBatch_;
    }

    /**
     * @notice registers the mocOperations bucket that would operate over this queue
     * @dev in order to operate, the queue needs to be whitelisted as EXECUTOR on the bucket as well
     * @param bucket_ address of the mocOperations implementation to interact with
     *
     * May emit a {RoleGranted} event for ENQUEUER role
     */
    function registerBucket(MocOperations bucket_) external onlyAuthorizedChanger {
        if (address(mocOperations) != address(0)) revert BucketAlreadyRegistered();
        mocOperations = bucket_;
        // internal, not role restricted granting, as it's protected by governance
        _grantRole(ENQUEUER_ROLE, address(bucket_));
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
