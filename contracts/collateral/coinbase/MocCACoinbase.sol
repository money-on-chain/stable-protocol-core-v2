// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { MocCore } from "../../core/MocCore.sol";
import { MocDeferred } from "../../core/MocDeferred.sol";
import { MocCoreShared } from "../../core/MocCoreShared.sol";

/**
 * @title MocCACoinbase: Moc Collateral Asset Coinbase
 * @notice Moc protocol implementation using network Coinbase as Collateral Asset
 */
contract MocCACoinbase is MocCoreShared {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param initializeDeferredParams_ contract initializer params
     * @dev governorAddress The address that will define when a change contract is authorized
     *      pauserAddress The address that is authorized to pause this contract
     *      tcTokenAddress Collateral Token contract address
     *      mocFeeFlowAddress Moc Fee Flow contract address
     *      mocAppreciationBeneficiaryAddress Moc appreciation beneficiary address
     *      protThrld protected state threshold [PREC]
     *      liqThrld liquidation coverage threshold [PREC]
     *      feeRetainer pct retain on fees to be re-injected as Collateral, while paying fees with AC [PREC]
     *      tcMintFee additional fee pct applied on mint Collateral Tokens operations [PREC]
     *      tcRedeemFee additional fee pct applied on redeem Collateral Tokens operations [PREC]
     *      successFee pct of the gain because Pegged Tokens devaluation that is transferred
     *        in Collateral Asset to Moc Fee Flow during the settlement [PREC]
     *      appreciationFactor pct of the gain because Pegged Tokens devaluation that is returned
     *        in Pegged Tokens to appreciation beneficiary during the settlement [PREC]
     *      bes number of blocks between settlements
     *      tcInterestCollectorAddress TC interest collector address
     *      tcInterestRate pct interest charged to TC holders on the total collateral in the protocol [PREC]
     *      tcInterestPaymentBlockSpan amount of blocks to wait for next TC interest payment
     *      maxAbsoluteOpProviderAddress max absolute operation provider address
     *      maxOpDiffProviderAddress max operation difference provider address
     *      decayBlockSpan number of blocks that have to elapse for the linear decay factor to be 0
     *      emaCalculationBlockSpan amount of blocks to wait between Pegged ema calculation
     *      mocVendors address for MocVendors contract
     *      mocQueueAddress address for MocQueue contract
     */
    function initialize(InitializeDeferredParams calldata initializeDeferredParams_) external initializer {
        __MocDeferred_init(initializeDeferredParams_);
    }

    // ------- Internal Functions -------

    /**
     * @inheritdoc MocCore
     */
    function acTransfer(address to_, uint256 amount_) internal override {
        if (amount_ > 0) {
            if (to_ == address(0)) revert InvalidAddress();
            // solhint-disable-next-line avoid-low-level-calls
            // TODO: when queued CA coinbase is allowed, this transfer should be gas capped
            // TODO: queue should also handle this fail when returning funds (unlocking)
            (bool success, ) = to_.call{ value: amount_ }("");
            if (!success) revert TransferFailed();
        }
    }

    /**
     * @inheritdoc MocCore
     */
    function acBalanceOf(address account) internal view override returns (uint256 balance) {
        return account.balance;
    }

    /**
     * @inheritdoc MocDeferred
     */
    function _getExecFeeSent() internal pure override returns (uint256 execFeeSent) {
        // TODO: execution fee are in 0
        return 0;
    }

    // ------- External Functions -------

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Collateral Token
     * @dev any extra value, not spent on TC nor fees, will be return to sender
     * @param qTC_ amount of Collateral Token to mint
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTC(uint256 qTC_) external payable returns (uint256 operId) {
        return _mintTCtoViaVendor(qTC_, msg.value, msg.sender, address(0));
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @dev any extra value, not spent on TC nor fees, will be return to sender
     * @param qTC_ amount of Collateral Token to mint
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTCViaVendor(uint256 qTC_, address vendor_) external payable returns (uint256 operId) {
        return _mintTCtoViaVendor(qTC_, msg.value, msg.sender, vendor_);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and recipient receives Collateral Token
     * @dev any extra value, not spent on TC nor fees, will be return to sender
     * @param qTC_ amount of Collateral Token to mint
     * @param recipient_ address who receives the Collateral Token
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTCto(uint256 qTC_, address recipient_) external payable returns (uint256 operId) {
        return _mintTCtoViaVendor(qTC_, msg.value, recipient_, address(0));
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and recipient receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @dev any extra value, not spent on TC nor fees, will be return to sender
     * @param qTC_ amount of Collateral Token to mint
     * @param recipient_ address who receives the Collateral Token
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTCtoViaVendor(
        uint256 qTC_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _mintTCtoViaVendor(qTC_, msg.value, recipient_, vendor_);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Pegged Token
     * @dev any extra value, not spent on TP nor fees, will be return to sender
     * @param tp_ Pegged Token address to mint
     * @param qTP_ amount of Pegged Token to mint
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTP(address tp_, uint256 qTP_) external payable returns (uint256 operId) {
        return _mintTPtoViaVendor(tp_, qTP_, msg.value, msg.sender, address(0));
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @dev any extra value, not spent on TP nor fees, will be return to sender
     * @param tp_ Pegged Token address
     * @param qTP_ amount of Pegged Token to mint
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTPViaVendor(address tp_, uint256 qTP_, address vendor_) external payable returns (uint256 operId) {
        return _mintTPtoViaVendor(tp_, qTP_, msg.value, msg.sender, vendor_);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and recipient receives Pegged Token
     * @dev any extra value, not spent on TP nor fees, will be return to sender
     * @param tp_ Pegged Token address to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param recipient_ address who receives the Pegged Token
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTPto(address tp_, uint256 qTP_, address recipient_) external payable returns (uint256 operId) {
        return _mintTPtoViaVendor(tp_, qTP_, msg.value, recipient_, address(0));
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and recipient receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @dev any extra value, not spent on TP nor fees, will be return to sender
     * @param tp_ Pegged Token address to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param recipient_ address who receives the Pegged Token
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTPtoViaVendor(
        address tp_,
        uint256 qTP_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _mintTPtoViaVendor(tp_, qTP_, msg.value, recipient_, vendor_);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Collateral Token and Pegged Token
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param tp_ Pegged Token address
     * @param qTP_ amount of Pegged Token to mint
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTCandTP(address tp_, uint256 qTP_) external payable returns (uint256 operId) {
        return _mintTCandTPtoViaVendor(tp_, qTP_, msg.value, msg.sender, address(0));
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Collateral Token and Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param tp_ Pegged Token address
     * @param qTP_ amount of Pegged Token to mint
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTCandTPViaVendor(
        address tp_,
        uint256 qTP_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _mintTCandTPtoViaVendor(tp_, qTP_, msg.value, msg.sender, vendor_);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and recipient receives Collateral Token and Pegged Token
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param tp_ Pegged Token address
     * @param qTP_ amount of Pegged Token to mint
     * @param recipient_ address who receives the Collateral Token and Pegged Token
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTCandTPto(address tp_, uint256 qTP_, address recipient_) external payable returns (uint256 operId) {
        return _mintTCandTPtoViaVendor(tp_, qTP_, msg.value, recipient_, address(0));
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and recipient receives Collateral Token and Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param tp_ Pegged Token address
     * @param qTP_ amount of Pegged Token to mint
     * @param recipient_ address who receives the Collateral Token and Pegged Token
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTCandTPtoViaVendor(
        address tp_,
        uint256 qTP_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _mintTCandTPtoViaVendor(tp_, qTP_, msg.value, recipient_, vendor_);
    }

    /**
     * @notice caller sends a Pegged Token and receives another one
     * @param tpFrom_ owned Pegged Token address
     * @param tpTo_ target Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that the sender expects to receive
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTPforTP(
        address tpFrom_,
        address tpTo_,
        uint256 qTP_,
        uint256 qTPmin_
    ) external payable returns (uint256 operId) {
        return _swapTPforTPtoViaVendor(tpFrom_, tpTo_, qTP_, qTPmin_, msg.value, msg.sender, address(0));
    }

    /**
     * @notice caller sends a Pegged Token and receives another one
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tpFrom_ owned Pegged Token address
     * @param tpTo_ target Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that the sender expects to receive
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTPforTPViaVendor(
        address tpFrom_,
        address tpTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _swapTPforTPtoViaVendor(tpFrom_, tpTo_, qTP_, qTPmin_, msg.value, msg.sender, vendor_);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives another one
     * @param tpFrom_ owned Pegged Token address
     * @param tpTo_ target Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param recipient_ address who receives the target Pegged Token
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTPforTPto(
        address tpFrom_,
        address tpTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        address recipient_
    ) external payable returns (uint256 operId) {
        return _swapTPforTPtoViaVendor(tpFrom_, tpTo_, qTP_, qTPmin_, msg.value, recipient_, address(0));
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives another one
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tpFrom_ owned Pegged Token address
     * @param tpTo_ target Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param recipient_ address who receives the target Pegged Token
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTPforTPtoViaVendor(
        address tpFrom_,
        address tpTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _swapTPforTPtoViaVendor(tpFrom_, tpTo_, qTP_, qTPmin_, msg.value, recipient_, vendor_);
    }

    /**
     * @notice caller sends a Pegged Token and receives Collateral Token
     * @param tp_ Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that the sender expects to receive
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTPforTC(address tp_, uint256 qTP_, uint256 qTCmin_) external payable returns (uint256 operId) {
        return _swapTPforTCtoViaVendor(tp_, qTP_, qTCmin_, msg.value, msg.sender, address(0));
    }

    /**
     * @notice caller sends a Pegged Token and receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tp_ Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that the sender expects to receive
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTPforTCViaVendor(
        address tp_,
        uint256 qTP_,
        uint256 qTCmin_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _swapTPforTCtoViaVendor(tp_, qTP_, qTCmin_, msg.value, msg.sender, vendor_);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Collateral Token
     * @param tp_ Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Token
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTPforTCto(
        address tp_,
        uint256 qTP_,
        uint256 qTCmin_,
        address recipient_
    ) external payable returns (uint256 operId) {
        return _swapTPforTCtoViaVendor(tp_, qTP_, qTCmin_, msg.value, recipient_, address(0));
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tp_ Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Token
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTPforTCtoViaVendor(
        address tp_,
        uint256 qTP_,
        uint256 qTCmin_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _swapTPforTCtoViaVendor(tp_, qTP_, qTCmin_, msg.value, recipient_, vendor_);
    }

    /**
     * @notice caller sends Collateral Token and receives Pegged Token
     * @param tp_ Pegged Token address
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that the sender expects to receive
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTCforTP(address tp_, uint256 qTC_, uint256 qTPmin_) external payable returns (uint256 operId) {
        return _swapTCforTPtoViaVendor(tp_, qTC_, qTPmin_, msg.value, msg.sender, address(0));
    }

    /**
     * @notice caller sends Collateral Token and receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tp_ Pegged Token address
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that the sender expects to receive
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTCforTPViaVendor(
        address tp_,
        uint256 qTC_,
        uint256 qTPmin_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _swapTCforTPtoViaVendor(tp_, qTC_, qTPmin_, msg.value, msg.sender, vendor_);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Pegged Token
     * @param tp_ Pegged Token address
     * @param qTC_ amount of Collateral to swap
     * @param qTPmin_ minimum amount of Pegged Token that `recipient_` expects to receive
     * @param recipient_ address who receives the Pegged Token
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTCforTPto(
        address tp_,
        uint256 qTC_,
        uint256 qTPmin_,
        address recipient_
    ) external payable returns (uint256 operId) {
        return _swapTCforTPtoViaVendor(tp_, qTC_, qTPmin_, msg.value, recipient_, address(0));
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tp_ Pegged Token address
     * @param qTC_ amount of Collateral to swap
     * @param qTPmin_ minimum amount of Pegged Token that `recipient_` expects to receive
     * @param recipient_ address who receives the Pegged Token
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTCforTPtoViaVendor(
        address tp_,
        uint256 qTC_,
        uint256 qTPmin_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return _swapTCforTPtoViaVendor(tp_, qTC_, qTPmin_, msg.value, recipient_, vendor_);
    }

    /**
     * @notice allow to send Coinbase to increment the Collateral Asset in the protocol
     */
    receive() external payable {
        _depositAC(msg.value);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */

    // Purposely left unused to save some state space to allow for future upgrades
    // slither-disable-next-line unused-state
    uint256[50] private __gap;
}
