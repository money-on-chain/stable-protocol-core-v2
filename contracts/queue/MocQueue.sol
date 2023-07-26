// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { MocAccessControlled } from "../utils/MocAccessControlled.sol";
import { MocCore } from "../core/MocCore.sol";
import { MocCARC20Deferred } from "../collateral/rc20/MocCARC20Deferred.sol";

bytes32 constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
bytes32 constant ENQUEUER_ROLE = keccak256("ENQUEUER_ROLE");

/**
 * @title MocQueue: Allows queue Operation deferral execution processing
 */
contract MocQueue is MocAccessControlled {
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
        uint256 indexed i_,
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
        uint256 indexed i_,
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
        address vendor_,
        uint256 operId_
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
        address vendor_,
        uint256 operId_
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
        address vendor_,
        uint256 operId_
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
        address vendor_,
        uint256 operId_
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
    function onDeferredTCMinted(
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
    function onDeferredTCRedeemed(
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
    function onDeferredTPMinted(
        uint256 operId_,
        MocCore.MintTPParams memory params_,
        uint256 qACtotalNeeded_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
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
    function onDeferredTPRedeemed(
        uint256 operId_,
        MocCore.RedeemTPParams memory params_,
        uint256 qACRedeemed_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
        emit TPRedeemed(
            params_.i,
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
    function onDeferredTCandTPMinted(
        uint256 operId_,
        MocCore.MintTCandTPParams memory params_,
        uint256 qTCMinted_,
        uint256 qACtotalNeeded_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
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
    function onDeferredTCandTPRedeemed(
        uint256 operId_,
        MocCore.RedeemTCandTPParams memory params_,
        uint256 qTPRedeemed_,
        uint256 qACRedeemed_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
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
    function onDeferredTCforTPSwapped(
        uint256 operId_,
        MocCore.SwapTCforTPParams memory params_,
        uint256 qTPMinted_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
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
    function onDeferredTPforTCSwapped(
        uint256 operId_,
        MocCore.SwapTPforTCParams memory params_,
        uint256 qTCMinted_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
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
    function onDeferredTPforTPSwapped(
        uint256 operId_,
        MocCore.SwapTPforTPParams memory params_,
        uint256 qTPMinted_,
        MocCore.FeeCalcs memory feeCalcs_
    ) internal {
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
            params_.vendor,
            operId_
        );
    }

    // ------- External Functions -------

    /**
     * @notice registered executors can process an existent Operations given by the `operId_`
     * @dev can revert for a number of reason, throws events according to the Oper type
     * @param operId_ Identifier to track the Operation lifecycle
     */
    function execute(uint256 operId_) external onlyRole(EXECUTOR_ROLE) {
        OperType operType = operTypes[operId_];
        uint256 qAC;
        uint256 qTC;
        uint256 qTP;
        MocCore.FeeCalcs memory feeCalcs;
        if (operType == OperType.mintTC) {
            MocCore.MintTCParams memory params = operationsMintTC[operId_];
            (qAC, , feeCalcs) = mocCore.execMintTC(params);
            onDeferredTCMinted(operId_, params, qAC, feeCalcs);
            delete operationsMintTC[operId_];
        } else if (operType == OperType.redeemTC) {
            MocCore.RedeemTCParams memory params = operationsRedeemTC[operId_];
            (qAC, , feeCalcs) = mocCore.execRedeemTC(params);
            onDeferredTCRedeemed(operId_, params, qAC, feeCalcs);
            delete operationsRedeemTC[operId_];
        } else if (operType == OperType.mintTP) {
            MocCore.MintTPParams memory params = operationsMintTP[operId_];
            (qAC, , feeCalcs) = mocCore.execMintTP(params);
            onDeferredTPMinted(operId_, params, qAC, feeCalcs);
            delete operationsMintTP[operId_];
        } else if (operType == OperType.redeemTP) {
            MocCore.RedeemTPParams memory params = operationsRedeemTP[operId_];
            (qAC, , feeCalcs) = mocCore.execRedeemTP(params);
            onDeferredTPRedeemed(operId_, params, qAC, feeCalcs);
            delete operationsRedeemTP[operId_];
        } else if (operType == OperType.mintTCandTP) {
            MocCore.MintTCandTPParams memory params = operationsMintTCandTP[operId_];
            (qAC, qTC, , feeCalcs) = mocCore.execMintTCandTP(params);
            onDeferredTCandTPMinted(operId_, params, qTC, qAC, feeCalcs);
            delete operationsMintTCandTP[operId_];
        } else if (operType == OperType.redeemTCandTP) {
            MocCore.RedeemTCandTPParams memory params = operationsRedeemTCandTP[operId_];
            (qAC, qTP, , feeCalcs) = mocCore.execRedeemTCandTP(params);
            onDeferredTCandTPRedeemed(operId_, params, qTP, qAC, feeCalcs);
            delete operationsRedeemTCandTP[operId_];
        } else if (operType == OperType.swapTCforTP) {
            MocCore.SwapTCforTPParams memory params = operationsSwapTCforTP[operId_];
            (, qTP, , feeCalcs) = mocCore.execSwapTCforTP(params);
            onDeferredTCforTPSwapped(operId_, params, qTP, feeCalcs);
            delete operationsSwapTCforTP[operId_];
        } else if (operType == OperType.swapTPforTC) {
            MocCore.SwapTPforTCParams memory params = operationsSwapTPforTC[operId_];
            (, qTC, , feeCalcs) = mocCore.execSwapTPforTC(params);
            onDeferredTPforTCSwapped(operId_, params, qTC, feeCalcs);
            delete operationsSwapTPforTC[operId_];
        } else if (operType == OperType.swapTPforTP) {
            MocCore.SwapTPforTPParams memory params = operationsSwapTPforTP[operId_];
            (, qTP, , feeCalcs) = mocCore.execSwapTPforTP(params);
            onDeferredTPforTPSwapped(operId_, params, qTP, feeCalcs);
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
    ) external onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.mintTC;
        operationsMintTC[operId] = params;
        operIdCount++;
    }

    /**
     * @notice registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueRedeemTC(
        MocCore.RedeemTCParams calldata params
    ) external onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.redeemTC;
        operationsRedeemTC[operId] = params;
        operIdCount++;
    }

    /**
     * @notice registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueMintTP(
        MocCore.MintTPParams calldata params
    ) external onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.mintTP;
        operationsMintTP[operId] = params;
        operIdCount++;
    }

    /**
     * @notice Registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueRedeemTP(
        MocCore.RedeemTPParams calldata params
    ) external onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.redeemTP;
        operationsRedeemTP[operId] = params;
        operIdCount++;
    }

    /**
     * @notice Registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueMintTCandTP(
        MocCore.MintTCandTPParams calldata params
    ) external onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.mintTCandTP;
        operationsMintTCandTP[operId] = params;
        operIdCount++;
    }

    /**
     * @notice Registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueRedeemTCandTP(
        MocCore.RedeemTCandTPParams calldata params
    ) external onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.redeemTCandTP;
        operationsRedeemTCandTP[operId] = params;
        operIdCount++;
    }

    /**
     * @notice Registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueSwapTCforTP(
        MocCore.SwapTCforTPParams calldata params
    ) external onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.swapTCforTP;
        operationsSwapTCforTP[operId] = params;
        operIdCount++;
    }

    /**
     * @notice Registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueSwapTPforTC(
        MocCore.SwapTPforTCParams calldata params
    ) external onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.swapTPforTC;
        operationsSwapTPforTC[operId] = params;
        operIdCount++;
    }

    /**
     * @notice Registered enqueuer can queue an Operations
     * @return operId Identifier to track the Operation lifecycle
     */
    function queueSwapTPforTP(
        MocCore.SwapTPforTPParams calldata params
    ) external onlyRole(ENQUEUER_ROLE) returns (uint256 operId) {
        operId = operIdCount;
        operTypes[operId] = OperType.swapTPforTP;
        operationsSwapTPforTP[operId] = params;
        operIdCount++;
    }
}
