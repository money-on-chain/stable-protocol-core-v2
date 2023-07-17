// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { MocCoreAccessControlled, MocCore } from "../../core/MocCoreAccessControlled.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IDispatcher } from "../../interfaces/IDispatcher.sol";

/**
 * @title MocCARC20Deferred: Moc Collateral Asset RC20 with deferred operations
 * @notice Moc protocol implementation using a RC20 as Collateral Asset.
 */
contract MocCARC20Deferred is MocCoreAccessControlled {
    // ------- Structs -------
    struct InitializeParams {
        InitializeCoreParams initializeCoreParams;
        // Collateral Asset Token contract address
        address acTokenAddress;
        // TODO: address dispatcherAddress;
    }

    // ------- Storage -------

    // Collateral Asset token
    IERC20 public acToken;

    // Dispatcher
    IDispatcher public dispatcher;

    // Amount of Operations created
    uint256 public operIdCount;

    mapping(uint256 => MintTCParams) public operationsMintTC;
    mapping(uint256 => MintTPParams) public operationsMintTP;
    mapping(uint256 => RedeemTCParams) public operationsRedeemTC;

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
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
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
    function _onACNeededOperation(uint256 qACMax_, uint256 qACNeeded_) internal pure override returns (uint256 change) {
        // As we locked qACMax, we need to return the extra amount
        // TODO: review this
        change = qACMax_ - qACNeeded_;
    }

    /* solhint-disable-next-line no-empty-blocks */
    function onTCMinted(MintTCParams memory p_, uint256 qACNeeded_, FeeCalcs memory fc_) internal override {
        //Do nothing, as event is later on emitted with OperId in context
    }

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

    // ------- External Functions -------

    function execute(uint256 operId) external onlyRole(EXECUTOR_ROLE) {
        OperType operType = operTypes[operId];
        if (operType == OperType.mintTC) {
            MintTCParams memory params = operationsMintTC[operId];
            (uint256 qACtotalNeeded_ /*qFeeTokenTotalNeeded*/, , FeeCalcs memory feeCalcs_) = _mintTCto(params);
            onDeferredTCMinted(operId, params, qACtotalNeeded_, feeCalcs_);
            delete operationsMintTC[operId];
        } else if (operType == OperType.redeemTC) {
            RedeemTCParams memory params = operationsRedeemTC[operId];
            _redeemTCto(params);
            delete operationsRedeemTC[operId];
        } else if (operType == OperType.mintTP) {
            MintTPParams memory params = operationsMintTP[operId];
            _mintTPto(params);
            delete operationsMintTP[operId];
        }
        // TODO: verify who keeps track of processed operations, and see if
        // re-processing or having this deleted doesn't interfere.
        delete operTypes[operId];
    }

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
        // Locks the funds
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        MintTCParams memory params = MintTCParams({
            qTC: qTC_,
            qACmax: qACmax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = operIdCount;
        operTypes[operId] = OperType.mintTC;
        operationsMintTC[operId] = params;
        operIdCount++;
    }

    // TODO: place and doc
    function onDeferredTCMinted(
        uint256 operId_,
        MintTCParams memory params_,
        uint256 qACtotalNeeded_,
        FeeCalcs memory feeCalcs_
    ) internal {
        // TODO: create a new event with OperId
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
        operId = operIdCount;
        operTypes[operId] = OperType.redeemTC;
        operationsRedeemTC[operId] = params;
        operIdCount++;
    }

    /**
     * @notice caller sends Collateral Asset and receives Pegged Token
        Requires prior sender approval of Collateral Asset to this contract
     * @param i_ Pegged Token index to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @return operId
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
     * @return operId
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
     * @return operId
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
     * @return operId
     */
    function mintTPtoViaVendor(
        uint256 i_,
        uint256 qTP_,
        uint256 qACmax_,
        address recipient_,
        address vendor_
    ) public payable returns (uint256 operId) {
        // Locks the funds
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        MintTPParams memory params = MintTPParams({
            i: i_,
            qTP: qTP_,
            qACmax: qACmax_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        operId = operIdCount;
        operTypes[operId] = OperType.mintTP;
        operationsMintTP[operId] = params;
        operIdCount++;
    }

    // /**
    //  * @notice caller sends Collateral Asset and receives Collateral Token and Pegged Token
    //  *  Requires prior sender approval of Collateral Asset to this contract
    //  *  This operation is done without checking coverage
    //  *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
    //  *  and global coverage are not modified.
    //  *  Reverts if qAC sent are insufficient.
    //  * @param i_ Pegged Token index
    //  * @param qTP_ amount of Pegged Token to mint
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent
    //  * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
    //  * @return qTCtoMint amount of Collateral Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function mintTCandTP(
    //     uint256 i_,
    //     uint256 qTP_,
    //     uint256 qACmax_
    // ) external payable returns (uint256 qACtotalNeeded, uint256 qTCtoMint, uint256 qFeeToken) {
    //     MintTCandTPParams memory params = MintTCandTPParams({
    //         i: i_,
    //         qTP: qTP_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: msg.sender,
    //         vendor: address(0)
    //     });
    //     return _mintTCandTPto(params);
    // }

    // /**
    //  * @notice caller sends Collateral Asset and receives Collateral Token and Pegged Token
    //  *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
    //  *  Requires prior sender approval of Collateral Asset to this contract
    //  *  This operation is done without checking coverage
    //  *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
    //  *  and global coverage are not modified.
    //  *  Reverts if qAC sent are insufficient.
    //  * @param i_ Pegged Token index
    //  * @param qTP_ amount of Pegged Token to mint
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent
    //  * @param vendor_ address who receives a markup
    //  * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
    //  * @return qTCtoMint amount of Collateral Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function mintTCandTPViaVendor(
    //     uint256 i_,
    //     uint256 qTP_,
    //     uint256 qACmax_,
    //     address vendor_
    // ) external payable returns (uint256 qACtotalNeeded, uint256 qTCtoMint, uint256 qFeeToken) {
    //     MintTCandTPParams memory params = MintTCandTPParams({
    //         i: i_,
    //         qTP: qTP_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: msg.sender,
    //         vendor: vendor_
    //     });
    //     return _mintTCandTPto(params);
    // }

    // /**
    //  * @notice caller sends Collateral Asset and recipient receives Collateral Token and Pegged Token
    //  *  Requires prior sender approval of Collateral Asset to this contract
    //  *  This operation is done without checking coverage
    //  *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
    //  *  and global coverage are not modified.
    //  *  Reverts if qAC sent are insufficient.
    //  * @param i_ Pegged Token index
    //  * @param qTP_ amount of Pegged Token to mint
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent
    //  * @param recipient_ address who receives the Collateral Token and Pegged Token
    //  * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
    //  * @return qTCtoMint amount of Collateral Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function mintTCandTPto(
    //     uint256 i_,
    //     uint256 qTP_,
    //     uint256 qACmax_,
    //     address recipient_
    // ) external payable returns (uint256 qACtotalNeeded, uint256 qTCtoMint, uint256 qFeeToken) {
    //     MintTCandTPParams memory params = MintTCandTPParams({
    //         i: i_,
    //         qTP: qTP_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: recipient_,
    //         vendor: address(0)
    //     });
    //     return _mintTCandTPto(params);
    // }

    // /**
    //  * @notice caller sends Collateral Asset and recipient receives Collateral Token and Pegged Token
    //  *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
    //  *  Requires prior sender approval of Collateral Asset to this contract
    //  *  This operation is done without checking coverage
    //  *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
    //  *  and global coverage are not modified.
    //  *  Reverts if qAC sent are insufficient.
    //  * @param i_ Pegged Token index
    //  * @param qTP_ amount of Pegged Token to mint
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent
    //  * @param recipient_ address who receives the Collateral Token and Pegged Token
    //  * @param vendor_ address who receives a markup
    //  * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
    //  * @return qTCtoMint amount of Collateral Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function mintTCandTPtoViaVendor(
    //     uint256 i_,
    //     uint256 qTP_,
    //     uint256 qACmax_,
    //     address recipient_,
    //     address vendor_
    // ) external payable returns (uint256 qACtotalNeeded, uint256 qTCtoMint, uint256 qFeeToken) {
    //     MintTCandTPParams memory params = MintTCandTPParams({
    //         i: i_,
    //         qTP: qTP_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: recipient_,
    //         vendor: vendor_
    //     });
    //     return _mintTCandTPto(params);
    // }

    // /**
    //  * @notice caller sends a Pegged Token and receives another one
    //  * @param iFrom_ owned Pegged Token index
    //  * @param iTo_ target Pegged Token index
    //  * @param qTP_ amount of owned Pegged Token to swap
    //  * @param qTPmin_ minimum amount of target Pegged Token that the sender expects to receive
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
    //  * @return qACFee amount of AC used to pay fee
    //  * @return qTPMinted amount of Pegged Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function swapTPforTP(
    //     uint256 iFrom_,
    //     uint256 iTo_,
    //     uint256 qTP_,
    //     uint256 qTPmin_,
    //     uint256 qACmax_
    // ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
    //     SwapTPforTPParams memory params = SwapTPforTPParams({
    //         iFrom: iFrom_,
    //         iTo: iTo_,
    //         qTP: qTP_,
    //         qTPmin: qTPmin_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: msg.sender,
    //         vendor: address(0)
    //     });
    //     return _swapTPforTPto(params);
    // }

    // /**
    //  * @notice caller sends a Pegged Token and receives another one
    //  *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
    //  * @param iFrom_ owned Pegged Token index
    //  * @param iTo_ target Pegged Token index
    //  * @param qTP_ amount of owned Pegged Token to swap
    //  * @param qTPmin_ minimum amount of target Pegged Token that the sender expects to receive
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
    //  * @param vendor_ address who receives a markup
    //  * @return qACFee amount of AC used to pay fee
    //  * @return qTPMinted amount of Pegged Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function swapTPforTPViaVendor(
    //     uint256 iFrom_,
    //     uint256 iTo_,
    //     uint256 qTP_,
    //     uint256 qTPmin_,
    //     uint256 qACmax_,
    //     address vendor_
    // ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
    //     SwapTPforTPParams memory params = SwapTPforTPParams({
    //         iFrom: iFrom_,
    //         iTo: iTo_,
    //         qTP: qTP_,
    //         qTPmin: qTPmin_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: msg.sender,
    //         vendor: vendor_
    //     });
    //     return _swapTPforTPto(params);
    // }

    // /**
    //  * @notice caller sends a Pegged Token and recipient receives another one
    //  * @param iFrom_ owned Pegged Token index
    //  * @param iTo_ target Pegged Token index
    //  * @param qTP_ amount of owned Pegged Token to swap
    //  * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
    //  * @param recipient_ address who receives the target Pegged Token
    //  * @return qACFee amount of AC used to pay fee
    //  * @return qTPMinted amount of Pegged Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function swapTPforTPto(
    //     uint256 iFrom_,
    //     uint256 iTo_,
    //     uint256 qTP_,
    //     uint256 qTPmin_,
    //     uint256 qACmax_,
    //     address recipient_
    // ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
    //     SwapTPforTPParams memory params = SwapTPforTPParams({
    //         iFrom: iFrom_,
    //         iTo: iTo_,
    //         qTP: qTP_,
    //         qTPmin: qTPmin_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: recipient_,
    //         vendor: address(0)
    //     });
    //     return _swapTPforTPto(params);
    // }

    // /**
    //  * @notice caller sends a Pegged Token and recipient receives another one
    //  *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
    //  * @param iFrom_ owned Pegged Token index
    //  * @param iTo_ target Pegged Token index
    //  * @param qTP_ amount of owned Pegged Token to swap
    //  * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
    //  * @param recipient_ address who receives the target Pegged Token
    //  * @param vendor_ address who receives a markup
    //  * @return qACFee amount of AC used to pay fee
    //  * @return qTPMinted amount of Pegged Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function swapTPforTPtoViaVendor(
    //     uint256 iFrom_,
    //     uint256 iTo_,
    //     uint256 qTP_,
    //     uint256 qTPmin_,
    //     uint256 qACmax_,
    //     address recipient_,
    //     address vendor_
    // ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
    //     SwapTPforTPParams memory params = SwapTPforTPParams({
    //         iFrom: iFrom_,
    //         iTo: iTo_,
    //         qTP: qTP_,
    //         qTPmin: qTPmin_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: recipient_,
    //         vendor: vendor_
    //     });
    //     return _swapTPforTPto(params);
    // }

    // /**
    //  * @notice caller sends a Pegged Token and receives Collateral Token
    //  * @param i_ Pegged Token index
    //  * @param qTP_ amount of owned Pegged Token to swap
    //  * @param qTCmin_ minimum amount of Collateral Token that the sender expects to receive
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
    //  * @return qACFee amount of AC used to pay fee
    //  * @return qTPMinted amount of Collateral Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function swapTPforTC(
    //     uint256 i_,
    //     uint256 qTP_,
    //     uint256 qTCmin_,
    //     uint256 qACmax_
    // ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
    //     SwapTPforTCParams memory params = SwapTPforTCParams({
    //         i: i_,
    //         qTP: qTP_,
    //         qTCmin: qTCmin_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: msg.sender,
    //         vendor: address(0)
    //     });
    //     return _swapTPforTCto(params);
    // }

    // /**
    //  * @notice caller sends a Pegged Token and receives Collateral Token
    //  *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
    //  * @param i_ Pegged Token index
    //  * @param qTP_ amount of owned Pegged Token to swap
    //  * @param qTCmin_ minimum amount of Collateral Token that the sender expects to receive
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
    //  * @param vendor_ address who receives a markup
    //  * @return qACFee amount of AC used to pay fee
    //  * @return qTPMinted amount of Collateral Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function swapTPforTCViaVendor(
    //     uint256 i_,
    //     uint256 qTP_,
    //     uint256 qTCmin_,
    //     uint256 qACmax_,
    //     address vendor_
    // ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
    //     SwapTPforTCParams memory params = SwapTPforTCParams({
    //         i: i_,
    //         qTP: qTP_,
    //         qTCmin: qTCmin_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: msg.sender,
    //         vendor: vendor_
    //     });
    //     return _swapTPforTCto(params);
    // }

    // /**
    //  * @notice caller sends a Pegged Token and recipient receives Collateral Token
    //  * @param i_ Pegged Token index
    //  * @param qTP_ amount of owned Pegged Token to swap
    //  * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
    //  * @param recipient_ address who receives the Collateral Token
    //  * @return qACFee amount of AC used to pay fee
    //  * @return qTPMinted amount of Collateral Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function swapTPforTCto(
    //     uint256 i_,
    //     uint256 qTP_,
    //     uint256 qTCmin_,
    //     uint256 qACmax_,
    //     address recipient_
    // ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
    //     SwapTPforTCParams memory params = SwapTPforTCParams({
    //         i: i_,
    //         qTP: qTP_,
    //         qTCmin: qTCmin_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: recipient_,
    //         vendor: address(0)
    //     });
    //     return _swapTPforTCto(params);
    // }

    // /**
    //  * @notice caller sends a Pegged Token and recipient receives Collateral Token
    //  *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
    //  * @param i_ Pegged Token index
    //  * @param qTP_ amount of owned Pegged Token to swap
    //  * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
    //  * @param recipient_ address who receives the Collateral Token
    //  * @param vendor_ address who receives a markup
    //  * @return qACFee amount of AC used to pay fee
    //  * @return qTPMinted amount of Collateral Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function swapTPforTCtoViaVendor(
    //     uint256 i_,
    //     uint256 qTP_,
    //     uint256 qTCmin_,
    //     uint256 qACmax_,
    //     address recipient_,
    //     address vendor_
    // ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
    //     SwapTPforTCParams memory params = SwapTPforTCParams({
    //         i: i_,
    //         qTP: qTP_,
    //         qTCmin: qTCmin_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: recipient_,
    //         vendor: vendor_
    //     });
    //     return _swapTPforTCto(params);
    // }

    // /**
    //  * @notice caller sends Collateral Token and receives Pegged Token
    //  * @param i_ Pegged Token index
    //  * @param qTC_ amount of Collateral Token to swap
    //  * @param qTPmin_ minimum amount of Pegged Token that the sender expects to receive
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
    //  * @return qACFee amount of AC used to pay fee
    //  * @return qTPMinted amount of Pegged Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function swapTCforTP(
    //     uint256 i_,
    //     uint256 qTC_,
    //     uint256 qTPmin_,
    //     uint256 qACmax_
    // ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
    //     SwapTCforTPParams memory params = SwapTCforTPParams({
    //         i: i_,
    //         qTC: qTC_,
    //         qTPmin: qTPmin_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: msg.sender,
    //         vendor: address(0)
    //     });
    //     return _swapTCforTPto(params);
    // }

    // /**
    //  * @notice caller sends Collateral Token and receives Pegged Token
    //  *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
    //  * @param i_ Pegged Token index
    //  * @param qTC_ amount of Collateral Token to swap
    //  * @param qTPmin_ minimum amount of Pegged Token that the sender expects to receive
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
    //  * @param vendor_ address who receives a markup
    //  * @return qACFee amount of AC used to pay fee
    //  * @return qTPMinted amount of Pegged Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function swapTCforTPViaVendor(
    //     uint256 i_,
    //     uint256 qTC_,
    //     uint256 qTPmin_,
    //     uint256 qACmax_,
    //     address vendor_
    // ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
    //     SwapTCforTPParams memory params = SwapTCforTPParams({
    //         i: i_,
    //         qTC: qTC_,
    //         qTPmin: qTPmin_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: msg.sender,
    //         vendor: vendor_
    //     });
    //     return _swapTCforTPto(params);
    // }

    // /**
    //  * @notice caller sends Collateral Token and recipient receives Pegged Token
    //  * @param i_ Pegged Token index
    //  * @param qTC_ amount of Collateral Token to swap
    //  * @param qTPmin_ minimum amount of Pegged Token that `recipient_` expects to receive
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
    //  * @param recipient_ address who receives the Pegged Token
    //  * @return qACFee amount of AC used to pay fee
    //  * @return qTPMinted amount of Pegged Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function swapTCforTPto(
    //     uint256 i_,
    //     uint256 qTC_,
    //     uint256 qTPmin_,
    //     uint256 qACmax_,
    //     address recipient_
    // ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
    //     SwapTCforTPParams memory params = SwapTCforTPParams({
    //         i: i_,
    //         qTC: qTC_,
    //         qTPmin: qTPmin_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: recipient_,
    //         vendor: address(0)
    //     });
    //     return _swapTCforTPto(params);
    // }

    // /**
    //  * @notice caller sends Collateral Token and recipient receives Pegged Token
    //  *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
    //  * @param i_ Pegged Token index
    //  * @param qTC_ amount of Collateral Token to swap
    //  * @param qTPmin_ minimum amount of Pegged Token that `recipient_` expects to receive
    //  * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
    //  * @param recipient_ address who receives the Pegged Token
    //  * @param vendor_ address who receives a markup
    //  * @return qACFee amount of AC used to pay fee
    //  * @return qTPMinted amount of Pegged Token minted
    //  * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
    //  */
    // function swapTCforTPtoViaVendor(
    //     uint256 i_,
    //     uint256 qTC_,
    //     uint256 qTPmin_,
    //     uint256 qACmax_,
    //     address recipient_,
    //     address vendor_
    // ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
    //     SwapTCforTPParams memory params = SwapTCforTPParams({
    //         i: i_,
    //         qTC: qTC_,
    //         qTPmin: qTPmin_,
    //         qACmax: qACmax_,
    //         sender: msg.sender,
    //         recipient: recipient_,
    //         vendor: vendor_
    //     });
    //     return _swapTCforTPto(params);
    // }

    /**
     * @notice Refreshes the AC holdings for the Bucket
     * @dev Intended to be use as notification after an RC20 AC transfer to this contract
     */
    // TODO: needs to discount queued locked AC value
    // function refreshACBalance() external {
    // }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */

    // Purposely left unused to save some state space to allow for future upgrades
    // slither-disable-next-line unused-state
    uint256[50] private __gap;
}
