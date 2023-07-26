// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { MocCore } from "../../core/MocCore.sol";
import { MocQueue, ENQUEUER_ROLE } from "../../queue/MocQueue.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IDispatcher } from "../../interfaces/IDispatcher.sol";

/**
 * @title MocCARC20Deferred: Moc Collateral Asset RC20 with deferred operations
 * @notice Moc protocol implementation using a RC20 as Collateral Asset.
 */
contract MocCARC20Deferred is MocCore {
    // ------- Structs -------
    struct InitializeParams {
        InitializeCoreParams initializeCoreParams;
        // Collateral Asset Token contract address
        address acTokenAddress;
        // TODO: address dispatcherAddress;
        address mocQueue;
    }

    // ------- Storage -------

    // Collateral Asset token
    IERC20 public acToken;

    // amount of AC locked on pending operations
    uint256 public qACLockedInPending;

    // Dispatcher
    IDispatcher public dispatcher;
    // Queue
    MocQueue public mocQueue;

    modifier onlyMocQueue() {
        //TODO
        require(msg.sender == address(mocQueue), "NOT queue");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param initializeParams_ contract initializer params
     * @dev governorAddress The address that will define when a change contract is authorized
     *      pauserAddress The address that is authorized to pause this contract
     *      acTokenAddress Collateral Asset Token contract address
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
     *      emaCalculationBlockSpan amount of blocks to wait between Pegged ema calculation
     *      mocVendors address for MocVendors contract
     */
    function initialize(InitializeParams calldata initializeParams_) external initializer {
        acToken = IERC20(initializeParams_.acTokenAddress);
        // TODO: initialize with a real dispatcher
        dispatcher = IDispatcher(address(0));
        __MocCore_init(initializeParams_.initializeCoreParams);
        mocQueue = MocQueue(initializeParams_.mocQueue);
    }

    // ------- Internal Functions -------

    /**
     * @inheritdoc MocCore
     * @dev this function could revert during safeTransfer call.
     *  safeTransfer will revert if token transfer reverts or returns 0
     */
    function acTransfer(address to_, uint256 amount_) internal override {
        if (amount_ > 0) {
            SafeERC20.safeTransfer(acToken, to_, amount_);
        }
    }

    /**
     * @inheritdoc MocCore
     */
    function acBalanceOf(address account) internal view override returns (uint256 balance) {
        return acToken.balanceOf(account);
    }

    /**
     * @notice hook before any AC reception involving operation, as dealing with a deferred RC20 Token
     * funds have already been transferred to the contract, so we need to return the unused
     * @param qACMax_ max amount of AC available
     * @param qACNeeded_ amount of AC needed
     * @return change amount needed to be return to the sender after the operation is complete
     */
    function _onACNeededOperation(uint256 qACMax_, uint256 qACNeeded_) internal override returns (uint256 change) {
        // As we locked qACMax, we need to return the extra amount
        // TODO: review this
        change = qACMax_ - qACNeeded_;
        // All locked AC is either unlock or returned, no longer on pending Operation
        qACLockedInPending -= qACMax_;
    }

    /**
     * @notice Refreshes the AC holdings for the Bucket
     * @dev Intended to be use as notification after an RC20 AC transfer to this contract
     */
    function refreshACBalance() external {
        uint256 unaccountedAcBalance = acBalanceOf(address(this)) - nACcb - qACLockedInPending;
        // On this implementation, AC token balance is nACcb plus AC locked on pending operations
        if (unaccountedAcBalance > 0) _depositAC(unaccountedAcBalance);
    }

    // Do nothing on Operation hooks, as event is later on emitted with OperId in context

    /* solhint-disable no-empty-blocks */
    function onTCMinted(MintTCParams memory p_, uint256 qAC_, FeeCalcs memory fc_) internal override {}

    function onTCRedeemed(RedeemTCParams memory p_, uint256 qAC_, FeeCalcs memory fc_) internal override {}

    function onTPMinted(MintTPParams memory p_, uint256 qAC_, FeeCalcs memory fc_) internal override {}

    function onTPRedeemed(RedeemTPParams memory p_, uint256 qAC_, FeeCalcs memory fc_) internal override {}

    function onTCandTPMinted(
        MintTCandTPParams memory p_,
        uint256 qTC_,
        uint256 qAC_,
        FeeCalcs memory fc_
    ) internal override {}

    function onTCandTPRedeemed(
        RedeemTCandTPParams memory p_,
        uint256 qTP_,
        uint256 qAC_,
        FeeCalcs memory fc_
    ) internal override {}

    function onTCSwappedForTP(SwapTCforTPParams memory p_, uint256 qTP_, FeeCalcs memory fc_) internal override {}

    function onTPSwappedForTC(SwapTPforTCParams memory p_, uint256 qTC_, FeeCalcs memory fc_) internal override {}

    function onTPSwappedForTP(SwapTPforTPParams memory p_, uint256 qTP_, FeeCalcs memory fc_) internal override {}

    /* solhint-enable no-empty-blocks */

    /**
     * @notice get combined global coverage
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return cglob [PREC]
     */
    function _getCglb(uint256 lckAC_, uint256 nACgain_) internal view override returns (uint256 cglob) {
        cglob = super._getCglb(lckAC_, nACgain_);
        //TODO: remove address != 0 check once we have real dispatcher implementation
        if (dispatcher != IDispatcher(address(0))) cglob = dispatcher.getCombinedCglb(cglob);
        return cglob;
    }

    /**
     * @notice get real amount of Collateral Token available to redeem
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return tcAvailableToRedeem [N]
     */
    function _getTCAvailableToRedeem(
        uint256 ctargemaCA_,
        uint256 lckAC_,
        uint256 nACgain_
    ) internal view override returns (uint256 tcAvailableToRedeem) {
        tcAvailableToRedeem = super._getTCAvailableToRedeem(ctargemaCA_, lckAC_, nACgain_);
        //TODO: remove address != 0 check once we have real dispatcher implementation
        if (dispatcher != IDispatcher(address(0)))
            tcAvailableToRedeem = dispatcher.getRealTCAvailableToRedeem(tcAvailableToRedeem);
        return tcAvailableToRedeem;
    }

    /**
     * @notice get real amount of Pegged Token available to mint
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset
     * @param ctargemaTP_ target coverage adjusted by the moving average of the value of a Pegged Token
     * @param pACtp_ Collateral Asset price in amount of Pegged Token [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return tpAvailableToMint [N]
     */
    function _getTPAvailableToMint(
        uint256 ctargemaCA_,
        uint256 ctargemaTP_,
        uint256 pACtp_,
        uint256 lckAC_,
        uint256 nACgain_
    ) internal view override returns (uint256 tpAvailableToMint) {
        tpAvailableToMint = super._getTPAvailableToMint(ctargemaCA_, ctargemaTP_, pACtp_, lckAC_, nACgain_);
        //TODO: remove address != 0 check once we have real dispatcher implementation
        if (dispatcher != IDispatcher(address(0)))
            tpAvailableToMint = dispatcher.getRealTPAvailableToMint(tpAvailableToMint);
        return tpAvailableToMint;
    }

    /**
     * @notice while registering a pending Operation, we need to lock user's funds until it's executed
     * @param qACToLock_ AC amount to be locked
     */
    function lockACInPending(uint256 qACToLock_) internal {
        qACLockedInPending += qACToLock_;
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACToLock_);
    }

    // ------- External Functions -------

    /**
     * @notice caller sends Collateral Asset and receives Collateral Token
        Requires prior sender approval of Collateral Asset to this contract 
     * @param qTC_ amount of Collateral Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTC(uint256 qTC_, uint256 qACmax_) external payable returns (uint256 operId) {
        return mintTCtoViaVendor(qTC_, qACmax_, msg.sender, address(0));
    }

    /**
     * @notice caller sends Collateral Asset and receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  Requires prior sender approval of Collateral Asset to this contract
     * @param qTC_ amount of Collateral Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTCViaVendor(uint256 qTC_, uint256 qACmax_, address vendor_) external payable returns (uint256 operId) {
        return mintTCtoViaVendor(qTC_, qACmax_, msg.sender, vendor_);
    }

    /**
     * @notice caller sends Collateral Asset and recipient receives Collateral Token
     *  Requires prior sender approval of Collateral Asset to this contract
     * @param qTC_ amount of Collateral Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param recipient_ address who receives the Collateral Token
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTCto(uint256 qTC_, uint256 qACmax_, address recipient_) external payable returns (uint256 operId) {
        return mintTCtoViaVendor(qTC_, qACmax_, recipient_, address(0));
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
    function mintTCtoViaVendor(
        uint256 qTC_,
        uint256 qACmax_,
        address recipient_,
        address vendor_
    ) public payable returns (uint256 operId) {
        lockACInPending(qACmax_);
        MintTCParams memory params = MintTCParams({
            qTC: qTC_,
            qACmax: qACmax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = mocQueue.queueMintTC(params);
    }

    /**
     * @notice caller sends Collateral Token and receives Collateral Asset
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTC(uint256 qTC_, uint256 qACmin_) external payable returns (uint256 operId) {
        return redeemTCtoViaVendor(qTC_, qACmin_, msg.sender, address(0));
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
        return redeemTCtoViaVendor(qTC_, qACmin_, msg.sender, vendor_);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Collateral Asset
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTCto(uint256 qTC_, uint256 qACmin_, address recipient_) external payable returns (uint256 operId) {
        return redeemTCtoViaVendor(qTC_, qACmin_, recipient_, address(0));
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
    ) public payable returns (uint256 operId) {
        RedeemTCParams memory params = RedeemTCParams({
            qTC: qTC_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = mocQueue.queueRedeemTC(params);
    }

    /**
     * @notice caller sends Collateral Asset and receives Pegged Token
        Requires prior sender approval of Collateral Asset to this contract
     * @param i_ Pegged Token index to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTP(uint256 i_, uint256 qTP_, uint256 qACmax_) external payable returns (uint256 operId) {
        return mintTPtoViaVendor(i_, qTP_, qACmax_, msg.sender, address(0));
    }

    /**
     * @notice caller sends Collateral Asset and receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *   Requires prior sender approval of Collateral Asset to this contract
     * @param i_ Pegged Token index to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTPViaVendor(
        uint256 i_,
        uint256 qTP_,
        uint256 qACmax_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return mintTPtoViaVendor(i_, qTP_, qACmax_, msg.sender, vendor_);
    }

    /**
     * @notice caller sends Collateral Asset and recipient receives Pegged Token
        Requires prior sender approval of Collateral Asset to this contract
     * @param i_ Pegged Token index to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param recipient_ address who receives the Pegged Token
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTPto(
        uint256 i_,
        uint256 qTP_,
        uint256 qACmax_,
        address recipient_
    ) external payable returns (uint256 operId) {
        return mintTPtoViaVendor(i_, qTP_, qACmax_, recipient_, address(0));
    }

    /**
     * @notice caller sends Collateral Asset and recipient receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *   Requires prior sender approval of Collateral Asset to this contract
     * @param i_ Pegged Token index to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param recipient_ address who receives the Pegged Token
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTPtoViaVendor(
        uint256 i_,
        uint256 qTP_,
        uint256 qACmax_,
        address recipient_,
        address vendor_
    ) public payable returns (uint256 operId) {
        lockACInPending(qACmax_);
        MintTPParams memory params = MintTPParams({
            i: i_,
            qTP: qTP_,
            qACmax: qACmax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = mocQueue.queueMintTP(params);
    }

    /**
     * @notice caller sends Pegged Token and receives Collateral Asset
     * @param i_ Pegged Token index to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTP(uint256 i_, uint256 qTP_, uint256 qACmin_) external payable returns (uint256 operId) {
        return redeemTPtoViaVendor(i_, qTP_, qACmin_, msg.sender, address(0));
    }

    /**
     * @notice caller sends Pegged Token and receives Collateral Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param i_ Pegged Token index to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTPViaVendor(
        uint256 i_,
        uint256 qTP_,
        uint256 qACmin_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return redeemTPtoViaVendor(i_, qTP_, qACmin_, msg.sender, vendor_);
    }

    /**
     * @notice caller sends Pegged Token and recipient receives Collateral Asset
     * @param i_ Pegged Token index to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTPto(
        uint256 i_,
        uint256 qTP_,
        uint256 qACmin_,
        address recipient_
    ) external payable returns (uint256 operId) {
        return redeemTPtoViaVendor(i_, qTP_, qACmin_, recipient_, address(0));
    }

    /**
     * @notice caller sends Pegged Token and recipient receives Collateral Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param i_ Pegged Token index to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function redeemTPtoViaVendor(
        uint256 i_,
        uint256 qTP_,
        uint256 qACmin_,
        address recipient_,
        address vendor_
    ) public payable returns (uint256 operId) {
        RedeemTPParams memory params = RedeemTPParams({
            i: i_,
            qTP: qTP_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = mocQueue.queueRedeemTP(params);
    }

    /**
     * @notice caller sends Collateral Asset and receives Collateral Token and Pegged Token
     *  Requires prior sender approval of Collateral Asset to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTCandTP(uint256 i_, uint256 qTP_, uint256 qACmax_) external payable returns (uint256 operId) {
        return mintTCandTPtoViaVendor(i_, qTP_, qACmax_, msg.sender, address(0));
    }

    /**
     * @notice caller sends Collateral Asset and receives Collateral Token and Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  Requires prior sender approval of Collateral Asset to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTCandTPViaVendor(
        uint256 i_,
        uint256 qTP_,
        uint256 qACmax_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return mintTCandTPtoViaVendor(i_, qTP_, qACmax_, msg.sender, vendor_);
    }

    /**
     * @notice caller sends Collateral Asset and recipient receives Collateral Token and Pegged Token
     *  Requires prior sender approval of Collateral Asset to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param recipient_ address who receives the Collateral Token and Pegged Token
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTCandTPto(
        uint256 i_,
        uint256 qTP_,
        uint256 qACmax_,
        address recipient_
    ) external payable returns (uint256 operId) {
        return mintTCandTPtoViaVendor(i_, qTP_, qACmax_, recipient_, address(0));
    }

    /**
     * @notice caller sends Collateral Asset and recipient receives Collateral Token and Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  Requires prior sender approval of Collateral Asset to this contract
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param recipient_ address who receives the Collateral Token and Pegged Token
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function mintTCandTPtoViaVendor(
        uint256 i_,
        uint256 qTP_,
        uint256 qACmax_,
        address recipient_,
        address vendor_
    ) public payable returns (uint256 operId) {
        MintTCandTPParams memory params = MintTCandTPParams({
            i: i_,
            qTP: qTP_,
            qACmax: qACmax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = mocQueue.queueMintTCandTP(params);
    }

    /**
     * @notice caller sends a Pegged Token and receives another one
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that the sender expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTPforTP(
        uint256 iFrom_,
        uint256 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qACmax_
    ) external payable returns (uint256 operId) {
        return swapTPforTPtoViaVendor(iFrom_, iTo_, qTP_, qTPmin_, qACmax_, msg.sender, address(0));
    }

    /**
     * @notice caller sends a Pegged Token and receives another one
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that the sender expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTPforTPViaVendor(
        uint256 iFrom_,
        uint256 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qACmax_,
        address vendor_
    ) external payable returns (uint256 operId) {
        return swapTPforTPtoViaVendor(iFrom_, iTo_, qTP_, qTPmin_, qACmax_, msg.sender, vendor_);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives another one
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @param recipient_ address who receives the target Pegged Token
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTPforTPto(
        uint256 iFrom_,
        uint256 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qACmax_,
        address recipient_
    ) external payable returns (uint256 operId) {
        return swapTPforTPtoViaVendor(iFrom_, iTo_, qTP_, qTPmin_, qACmax_, recipient_, address(0));
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives another one
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @param recipient_ address who receives the target Pegged Token
     * @param vendor_ address who receives a markup
     * @return operId Identifier to track the Operation lifecycle
     */
    function swapTPforTPtoViaVendor(
        uint256 iFrom_,
        uint256 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qACmax_,
        address recipient_,
        address vendor_
    ) public payable returns (uint256 operId) {
        SwapTPforTPParams memory params = SwapTPforTPParams({
            iFrom: iFrom_,
            iTo: iTo_,
            qTP: qTP_,
            qTPmin: qTPmin_,
            qACmax: qACmax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = mocQueue.queueSwapTPforTP(params);
    }

    /**
     * @notice caller sends a Pegged Token and receives Collateral Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that the sender expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @return qACFee amount of AC used to pay fee
     * @return qTCMinted amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTC(
        uint256 i_,
        uint256 qTP_,
        uint256 qTCmin_,
        uint256 qACmax_
    ) external payable returns (uint256 qACFee, uint256 qTCMinted, uint256 qFeeToken) {
        SwapTPforTCParams memory params = SwapTPforTCParams({
            i: i_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qACmax: qACmax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        (qACFee, qTCMinted, qFeeToken, ) = _swapTPforTCto(params);
    }

    /**
     * @notice caller sends a Pegged Token and receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param i_ Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that the sender expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @param vendor_ address who receives a markup
     * @return qACFee amount of AC used to pay fee
     * @return qTCMinted amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTCViaVendor(
        uint256 i_,
        uint256 qTP_,
        uint256 qTCmin_,
        uint256 qACmax_,
        address vendor_
    ) external payable returns (uint256 qACFee, uint256 qTCMinted, uint256 qFeeToken) {
        SwapTPforTCParams memory params = SwapTPforTCParams({
            i: i_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qACmax: qACmax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        (qACFee, qTCMinted, qFeeToken, ) = _swapTPforTCto(params);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Collateral Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @param recipient_ address who receives the Collateral Token
     * @return qACFee amount of AC used to pay fee
     * @return qTCMinted amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTCto(
        uint256 i_,
        uint256 qTP_,
        uint256 qTCmin_,
        uint256 qACmax_,
        address recipient_
    ) external payable returns (uint256 qACFee, uint256 qTCMinted, uint256 qFeeToken) {
        SwapTPforTCParams memory params = SwapTPforTCParams({
            i: i_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qACmax: qACmax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        (qACFee, qTCMinted, qFeeToken, ) = _swapTPforTCto(params);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param i_ Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @param recipient_ address who receives the Collateral Token
     * @param vendor_ address who receives a markup
     * @return qACFee amount of AC used to pay fee
     * @return qTCMinted amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTCtoViaVendor(
        uint256 i_,
        uint256 qTP_,
        uint256 qTCmin_,
        uint256 qACmax_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 qACFee, uint256 qTCMinted, uint256 qFeeToken) {
        SwapTPforTCParams memory params = SwapTPforTCParams({
            i: i_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qACmax: qACmax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        (qACFee, qTCMinted, qFeeToken, ) = _swapTPforTCto(params);
    }

    /**
     * @notice caller sends Collateral Token and receives Pegged Token
     * @param i_ Pegged Token index
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that the sender expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTCforTP(
        uint256 i_,
        uint256 qTC_,
        uint256 qTPmin_,
        uint256 qACmax_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTCforTPParams memory params = SwapTCforTPParams({
            i: i_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qACmax: qACmax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        (qACFee, qTPMinted, qFeeToken, ) = _swapTCforTPto(params);
    }

    /**
     * @notice caller sends Collateral Token and receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param i_ Pegged Token index
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that the sender expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @param vendor_ address who receives a markup
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTCforTPViaVendor(
        uint256 i_,
        uint256 qTC_,
        uint256 qTPmin_,
        uint256 qACmax_,
        address vendor_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTCforTPParams memory params = SwapTCforTPParams({
            i: i_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qACmax: qACmax_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        (qACFee, qTPMinted, qFeeToken, ) = _swapTCforTPto(params);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Pegged Token
     * @param i_ Pegged Token index
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that `recipient_` expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @param recipient_ address who receives the Pegged Token
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTCforTPto(
        uint256 i_,
        uint256 qTC_,
        uint256 qTPmin_,
        uint256 qACmax_,
        address recipient_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTCforTPParams memory params = SwapTCforTPParams({
            i: i_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qACmax: qACmax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        (qACFee, qTPMinted, qFeeToken, ) = _swapTCforTPto(params);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param i_ Pegged Token index
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that `recipient_` expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @param recipient_ address who receives the Pegged Token
     * @param vendor_ address who receives a markup
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTCforTPtoViaVendor(
        uint256 i_,
        uint256 qTC_,
        uint256 qTPmin_,
        uint256 qACmax_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTCforTPParams memory params = SwapTCforTPParams({
            i: i_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qACmax: qACmax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        (qACFee, qTPMinted, qFeeToken, ) = _swapTCforTPto(params);
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
        return _redeemTCto(params_);
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
        return _redeemTCandTPto(params_);
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
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */

    // Purposely left unused to save some state space to allow for future upgrades
    // slither-disable-next-line unused-state
    uint256[50] private __gap;
}
