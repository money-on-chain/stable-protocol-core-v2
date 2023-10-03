// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { MocAccessControlled } from "../utils/MocAccessControlled.sol";
import { MocCore, MocCommons } from "../core/MocCore.sol";
import { MocBaseBucket } from "../core/MocBaseBucket.sol";
import { MocCARC20Deferred } from "../collateral/rc20/MocCARC20Deferred.sol";

bytes32 constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
bytes32 constant ENQUEUER_ROLE = keccak256("ENQUEUER_ROLE");

/**
 * @title MocQueue: Allows queue Operation deferral execution processing
 */
contract MocQueue is MocAccessControlled {
    // ------- Events -------
    event OperationError(uint256 operId_, bytes4 errorCode_, string msg_);
    event UnhandledError(uint256 operId_, bytes reason_);

    event OperationQueued(address indexed bucket_, uint256 operId_, OperType operType_);

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

    // ------- Storage -------

    MocCARC20Deferred public mocCore;

    // TODO
    function registerBucket(MocCARC20Deferred bucket) public {
        mocCore = bucket;
        grantRole(ENQUEUER_ROLE, address(bucket));
    }

    // Amount of Operations created
    uint256 public operIdCount;

    // TODO: import structs
    mapping(uint256 => MocCore.MintTCParams) public operationsMintTC;
    mapping(uint256 => MocCore.MintTPParams) public operationsMintTP;
    mapping(uint256 => MocCore.RedeemTCParams) public operationsRedeemTC;
    mapping(uint256 => MocCore.RedeemTPParams) public operationsRedeemTP;
    mapping(uint256 => MocCore.MintTCandTPParams) public operationsMintTCandTP;
    mapping(uint256 => MocCore.RedeemTCandTPParams) public operationsRedeemTCandTP;
    mapping(uint256 => MocCore.SwapTCforTPParams) public operationsSwapTCforTP;
    mapping(uint256 => MocCore.SwapTPforTCParams) public operationsSwapTPforTC;
    mapping(uint256 => MocCore.SwapTPforTPParams) public operationsSwapTPforTP;

    // Set of Deferrable Operation Types
    enum OperType {
        none, // avoid using zero as Type
        mintTC,
        redeemTC,
        mintTP,
        redeemTP,
        mintTCandTP,
        redeemTCandTP,
        swapTCforTP,
        swapTPforTC,
        swapTPforTP
    }
    // OperId => Operation Type
    mapping(uint256 => OperType) public operTypes;

    // ------- Initializer -------

    function initialize(address governor_, address pauser_) external initializer {
        __AccessControl_init();
        __MocUpgradable_init(governor_, pauser_);
        // TODO:
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
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
     *
     * May emit {TCMinted, OperationError, UnhandledError} events
     */
    function _executeMintTC(uint256 operId_) internal virtual {
        MocCore.MintTCParams memory params = operationsMintTC[operId_];
        try mocCore.execMintTC(params) returns (uint256 _qACtotalNeeded, uint256, MocCore.FeeCalcs memory _feeCalcs) {
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
            // TODO: charge execution fees if not already
            mocCore.unlockACInPending(params.sender, params.qACmax);
        }
        // Independently from the result, we delete the operation params
        delete operationsMintTC[operId_];
    }

    /**
     * @notice Executes redeem TC handling any error
     * @param operId_ operation id
     *
     * May emit {TCRedeemed, OperationError, UnhandledError} events
     */
    function _executeRedeemTC(uint256 operId_) internal virtual {
        MocCore.RedeemTCParams memory params = operationsRedeemTC[operId_];
        try mocCore.execRedeemTC(params) returns (uint256 _qACRedeemed, uint256, MocCore.FeeCalcs memory _feeCalcs) {
            _onDeferredTCRedeemed(operId_, params, _qACRedeemed, _feeCalcs);
        } catch (bytes memory returnData) {
            // TODO: analyze if it's necessary to decode error params, returnData needs to be
            // padded/shifted as decode only takes bytes32 chunks and error selector is just 4 bytes.
            bytes4 errorSelector = bytes4(returnData);
            if (errorSelector == MocCommons.InsufficientTCtoRedeem.selector) {
                emit OperationError(operId_, errorSelector, "Insufficient tc to redeem");
            } else if (errorSelector == MocCore.QacBelowMinimumRequired.selector) {
                emit OperationError(operId_, errorSelector, "qAC below minimum required");
            } else if (errorSelector == MocBaseBucket.LowCoverage.selector) {
                emit OperationError(operId_, errorSelector, "Low coverage");
            } else emit UnhandledError(operId_, returnData);

            // On a failed Operation, we unlock user funds
            mocCore.unlockTCInPending(params.sender, params.qTC);
        }
        // Independently from the result, we delete the operation params
        delete operationsRedeemTC[operId_];
    }

    /**
     * @notice Executes mint TP handling any error
     * @param operId_ operation id
     *
     * May emit {TPMinted, OperationError, UnhandledError} events
     */
    function _executeMintTP(uint256 operId_) internal virtual {
        MocCore.MintTPParams memory params = operationsMintTP[operId_];
        try mocCore.execMintTP(params) returns (uint256 _qACtotalNeeded, uint256, MocCore.FeeCalcs memory _feeCalcs) {
            _onDeferredTPMinted(operId_, params, _qACtotalNeeded, _feeCalcs);
        } catch (bytes memory returnData) {
            // TODO: analyze if it's necessary to decode error params, returnData needs to be
            // padded/shifted as decode only takes bytes32 chunks and error selector is just 4 bytes.
            bytes4 errorSelector = bytes4(returnData);
            if (errorSelector == MocCommons.InsufficientTPtoMint.selector) {
                emit OperationError(operId_, errorSelector, "Insufficient tp to mint");
            } else if (errorSelector == MocCommons.InsufficientQacSent.selector) {
                emit OperationError(operId_, errorSelector, "Insufficient qac sent");
            } else if (errorSelector == MocBaseBucket.LowCoverage.selector) {
                emit OperationError(operId_, errorSelector, "Low coverage");
            } else emit UnhandledError(operId_, returnData);

            // On a failed Operation, we unlock user funds
            // TODO: charge execution fees if not already
            mocCore.unlockACInPending(params.sender, params.qACmax);
        }
        // Independently from the result, we delete the operation params
        delete operationsMintTP[operId_];
    }

    // ------- External Functions -------

    /**
     * @notice registered executors can process an existent Operations given by the `operId_`
     * @dev can revert for a number of reason, throws events according to the Oper type
     * @param operId_ Identifier for the Operation to be executed
     */
    function execute(uint256 operId_) external notPaused onlyRole(EXECUTOR_ROLE) {
        // TODO: handle nonexistent or old IDs
        OperType operType = operTypes[operId_];
        uint256 qAC;
        uint256 qTC;
        uint256 qTP;
        MocCore.FeeCalcs memory feeCalcs;
        if (operType == OperType.mintTC) {
            _executeMintTC(operId_);
        } else if (operType == OperType.redeemTC) {
            _executeRedeemTC(operId_);
        } else if (operType == OperType.mintTP) {
            _executeMintTP(operId_);
        } else if (operType == OperType.redeemTP) {
            MocCore.RedeemTPParams memory params = operationsRedeemTP[operId_];
            (qAC, , feeCalcs) = mocCore.execRedeemTP(params);
            _onDeferredTPRedeemed(operId_, params, qAC, feeCalcs);
            delete operationsRedeemTP[operId_];
        } else if (operType == OperType.mintTCandTP) {
            MocCore.MintTCandTPParams memory params = operationsMintTCandTP[operId_];
            (qAC, qTC, , feeCalcs) = mocCore.execMintTCandTP(params);
            _onDeferredTCandTPMinted(operId_, params, qTC, qAC, feeCalcs);
            delete operationsMintTCandTP[operId_];
        } else if (operType == OperType.redeemTCandTP) {
            MocCore.RedeemTCandTPParams memory params = operationsRedeemTCandTP[operId_];
            (qAC, qTP, , feeCalcs) = mocCore.execRedeemTCandTP(params);
            _onDeferredTCandTPRedeemed(operId_, params, qTP, qAC, feeCalcs);
            delete operationsRedeemTCandTP[operId_];
        } else if (operType == OperType.swapTCforTP) {
            MocCore.SwapTCforTPParams memory params = operationsSwapTCforTP[operId_];
            (, qTP, , feeCalcs) = mocCore.execSwapTCforTP(params);
            _onDeferredTCforTPSwapped(operId_, params, qTP, feeCalcs);
            delete operationsSwapTCforTP[operId_];
        } else if (operType == OperType.swapTPforTC) {
            MocCore.SwapTPforTCParams memory params = operationsSwapTPforTC[operId_];
            (, qTC, , feeCalcs) = mocCore.execSwapTPforTC(params);
            _onDeferredTPforTCSwapped(operId_, params, qTC, feeCalcs);
            delete operationsSwapTPforTC[operId_];
        } else if (operType == OperType.swapTPforTP) {
            MocCore.SwapTPforTPParams memory params = operationsSwapTPforTP[operId_];
            (, qTP, , feeCalcs) = mocCore.execSwapTPforTP(params);
            _onDeferredTPforTPSwapped(operId_, params, qTP, feeCalcs);
            delete operationsSwapTPforTP[operId_];
        }

        // TODO: verify who/how keeps track of processed operations, and see if
        // re-processing or having this deleted doesn't interfere.
        delete operTypes[operId_];
    }

    /**
     * @notice registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueMintTC(
        MocCore.MintTCParams calldata params
    ) external notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.mintTC;
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
    ) external notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.redeemTC;
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
    ) external notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.mintTP;
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
    ) external notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.redeemTP;
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
    ) external notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.mintTCandTP;
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
    ) external notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.redeemTCandTP;
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
    ) external notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.swapTCforTP;
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
    ) external notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.swapTPforTC;
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
    ) external notPaused onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.swapTPforTP;
        operationsSwapTPforTP[operId] = params;
        emit OperationQueued(msg.sender, operId, OperType.swapTPforTP);
        operIdCount++;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
