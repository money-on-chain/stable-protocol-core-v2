// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { MocCoreShared, MocCore } from "../../core/MocCoreShared.sol";

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
     * @param initializeCoreParams_ contract initializer params
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
     *      emaCalculationBlockSpan amount of blocks to wait between Pegged ema calculation
     *      mocVendors address for MocVendors contract
     */
    function initialize(InitializeCoreParams calldata initializeCoreParams_) external initializer {
        __MocCore_init(initializeCoreParams_);
    }

    // ------- Internal Functions -------

    /**
     * @inheritdoc MocCore
     */
    function acTransfer(address to_, uint256 amount_) internal override {
        if (amount_ > 0) {
            if (to_ == address(0)) revert InvalidAddress();
            // solhint-disable-next-line avoid-low-level-calls
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
     * @notice hook before any AC reception involving operation, as dealing with an RC20 Token
     * we need to transfer the AC amount from the user, to the contract
     * @param qACMax_ max amount of AC available
     * @param qACNeeded_ amount of AC needed
     * @return change amount needed to be return to the sender after the operation is complete
     */
    function _onACNeededOperation(uint256 qACMax_, uint256 qACNeeded_) internal pure override returns (uint256 change) {
        change = qACMax_ - qACNeeded_;
    }

    // ------- External Functions -------

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Collateral Token
     * @dev any extra value, not spent on TC nor fees, will be return to sender
     * @param qTC_ amount of Collateral Token to mint
     * @return qACtotalNeeded amount of AC used to mint qTC
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTC(uint256 qTC_) external payable returns (uint256 qACtotalNeeded, uint256 qFeeToken) {
        MintTCParams memory params = MintTCParams({
            qTC: qTC_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        (qACtotalNeeded, qFeeToken, ) = _mintTCto(params);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @dev any extra value, not spent on TC nor fees, will be return to sender
     * @param qTC_ amount of Collateral Token to mint
     * @param vendor_ address who receives a markup
     * @return qACtotalNeeded amount of AC used to mint qTC
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTCViaVendor(
        uint256 qTC_,
        address vendor_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qFeeToken) {
        MintTCParams memory params = MintTCParams({
            qTC: qTC_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        (qACtotalNeeded, qFeeToken, ) = _mintTCto(params);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and recipient receives Collateral Token
     * @dev any extra value, not spent on TC nor fees, will be return to sender
     * @param qTC_ amount of Collateral Token to mint
     * @param recipient_ address who receives the Collateral Token
     * @return qACtotalNeeded amount of AC used to mint qTC
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTCto(
        uint256 qTC_,
        address recipient_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qFeeToken) {
        MintTCParams memory params = MintTCParams({
            qTC: qTC_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        (qACtotalNeeded, qFeeToken, ) = _mintTCto(params);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and recipient receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @dev any extra value, not spent on TC nor fees, will be return to sender
     * @param qTC_ amount of Collateral Token to mint
     * @param recipient_ address who receives the Collateral Token
     * @param vendor_ address who receives a markup
     * @return qACtotalNeeded amount of AC used to mint qTC
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTCtoViaVendor(
        uint256 qTC_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qFeeToken) {
        MintTCParams memory params = MintTCParams({
            qTC: qTC_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        (qACtotalNeeded, qFeeToken, ) = _mintTCto(params);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Pegged Token
     * @dev any extra value, not spent on TP nor fees, will be return to sender
     * @param tp_ Pegged Token address to mint
     * @param qTP_ amount of Pegged Token to mint
     * @return qACtotalNeeded amount of AC used to mint qTP
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTP(address tp_, uint256 qTP_) external payable returns (uint256 qACtotalNeeded, uint256 qFeeToken) {
        MintTPParams memory params = MintTPParams({
            tp: tp_,
            qTP: qTP_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        (qACtotalNeeded, qFeeToken, ) = _mintTPto(params);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @dev any extra value, not spent on TP nor fees, will be return to sender
     * @param tp_ Pegged Token address
     * @param qTP_ amount of Pegged Token to mint
     * @param vendor_ address who receives a markup
     * @return qACtotalNeeded amount of AC used to mint qTP
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTPViaVendor(
        address tp_,
        uint256 qTP_,
        address vendor_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qFeeToken) {
        MintTPParams memory params = MintTPParams({
            tp: tp_,
            qTP: qTP_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        (qACtotalNeeded, qFeeToken, ) = _mintTPto(params);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and recipient receives Pegged Token
     * @dev any extra value, not spent on TP nor fees, will be return to sender
     * @param tp_ Pegged Token address to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param recipient_ address who receives the Pegged Token
     * @return qACtotalNeeded amount of AC used to mint qTP
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTPto(
        address tp_,
        uint256 qTP_,
        address recipient_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qFeeToken) {
        MintTPParams memory params = MintTPParams({
            tp: tp_,
            qTP: qTP_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        (qACtotalNeeded, qFeeToken, ) = _mintTPto(params);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and recipient receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @dev any extra value, not spent on TP nor fees, will be return to sender
     * @param tp_ Pegged Token address to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param recipient_ address who receives the Pegged Token
     * @param vendor_ address who receives a markup
     * @return qACtotalNeeded amount of AC used to mint qTP
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTPtoViaVendor(
        address tp_,
        uint256 qTP_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qFeeToken) {
        MintTPParams memory params = MintTPParams({
            tp: tp_,
            qTP: qTP_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        (qACtotalNeeded, qFeeToken, ) = _mintTPto(params);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Collateral Token and Pegged Token
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param tp_ Pegged Token address
     * @param qTP_ amount of Pegged Token to mint
     * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
     * @return qTCMinted amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTCandTP(
        address tp_,
        uint256 qTP_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qTCMinted, uint256 qFeeToken) {
        MintTCandTPParams memory params = MintTCandTPParams({
            tp: tp_,
            qTP: qTP_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        (qACtotalNeeded, qTCMinted, qFeeToken, ) = _mintTCandTPto(params);
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
     * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
     * @return qTCMinted amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTCandTPViaVendor(
        address tp_,
        uint256 qTP_,
        address vendor_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qTCMinted, uint256 qFeeToken) {
        MintTCandTPParams memory params = MintTCandTPParams({
            tp: tp_,
            qTP: qTP_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        (qACtotalNeeded, qTCMinted, qFeeToken, ) = _mintTCandTPto(params);
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
     * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
     * @return qTCMinted amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTCandTPto(
        address tp_,
        uint256 qTP_,
        address recipient_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qTCMinted, uint256 qFeeToken) {
        MintTCandTPParams memory params = MintTCandTPParams({
            tp: tp_,
            qTP: qTP_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        (qACtotalNeeded, qTCMinted, qFeeToken, ) = _mintTCandTPto(params);
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
     * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
     * @return qTCMinted amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTCandTPtoViaVendor(
        address tp_,
        uint256 qTP_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qTCMinted, uint256 qFeeToken) {
        MintTCandTPParams memory params = MintTCandTPParams({
            tp: tp_,
            qTP: qTP_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        (qACtotalNeeded, qTCMinted, qFeeToken, ) = _mintTCandTPto(params);
    }

    /**
     * @notice caller sends a Pegged Token and receives another one
     * @param tpFrom_ owned Pegged Token address
     * @param tpTo_ target Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that the sender expects to receive
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTP(
        address tpFrom_,
        address tpTo_,
        uint256 qTP_,
        uint256 qTPmin_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTPforTPParams memory params = SwapTPforTPParams({
            tpFrom: tpFrom_,
            tpTo: tpTo_,
            qTP: qTP_,
            qTPmin: qTPmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        (qACFee, qTPMinted, qFeeToken, ) = _swapTPforTPto(params, msg.sender);
    }

    /**
     * @notice caller sends a Pegged Token and receives another one
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tpFrom_ owned Pegged Token address
     * @param tpTo_ target Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that the sender expects to receive
     * @param vendor_ address who receives a markup
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTPViaVendor(
        address tpFrom_,
        address tpTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        address vendor_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTPforTPParams memory params = SwapTPforTPParams({
            tpFrom: tpFrom_,
            tpTo: tpTo_,
            qTP: qTP_,
            qTPmin: qTPmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        (qACFee, qTPMinted, qFeeToken, ) = _swapTPforTPto(params, msg.sender);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives another one
     * @param tpFrom_ owned Pegged Token address
     * @param tpTo_ target Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param recipient_ address who receives the target Pegged Token
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTPto(
        address tpFrom_,
        address tpTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        address recipient_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTPforTPParams memory params = SwapTPforTPParams({
            tpFrom: tpFrom_,
            tpTo: tpTo_,
            qTP: qTP_,
            qTPmin: qTPmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        (qACFee, qTPMinted, qFeeToken, ) = _swapTPforTPto(params, msg.sender);
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
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTPtoViaVendor(
        address tpFrom_,
        address tpTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTPforTPParams memory params = SwapTPforTPParams({
            tpFrom: tpFrom_,
            tpTo: tpTo_,
            qTP: qTP_,
            qTPmin: qTPmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        (qACFee, qTPMinted, qFeeToken, ) = _swapTPforTPto(params, msg.sender);
    }

    /**
     * @notice caller sends a Pegged Token and receives Collateral Token
     * @param tp_ Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that the sender expects to receive
     * @return qACFee amount of AC used to pay fee
     * @return qTCMinted amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTC(
        address tp_,
        uint256 qTP_,
        uint256 qTCmin_
    ) external payable returns (uint256 qACFee, uint256 qTCMinted, uint256 qFeeToken) {
        SwapTPforTCParams memory params = SwapTPforTCParams({
            tp: tp_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        (qACFee, qTCMinted, qFeeToken, ) = _swapTPforTCto(params, msg.sender);
    }

    /**
     * @notice caller sends a Pegged Token and receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tp_ Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that the sender expects to receive
     * @param vendor_ address who receives a markup
     * @return qACFee amount of AC used to pay fee
     * @return qTCMinted amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTCViaVendor(
        address tp_,
        uint256 qTP_,
        uint256 qTCmin_,
        address vendor_
    ) external payable returns (uint256 qACFee, uint256 qTCMinted, uint256 qFeeToken) {
        SwapTPforTCParams memory params = SwapTPforTCParams({
            tp: tp_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        (qACFee, qTCMinted, qFeeToken, ) = _swapTPforTCto(params, msg.sender);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Collateral Token
     * @param tp_ Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Token
     * @return qACFee amount of AC used to pay fee
     * @return qTCMinted amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTCto(
        address tp_,
        uint256 qTP_,
        uint256 qTCmin_,
        address recipient_
    ) external payable returns (uint256 qACFee, uint256 qTCMinted, uint256 qFeeToken) {
        SwapTPforTCParams memory params = SwapTPforTCParams({
            tp: tp_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        (qACFee, qTCMinted, qFeeToken, ) = _swapTPforTCto(params, msg.sender);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Collateral Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tp_ Pegged Token address
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Token
     * @param vendor_ address who receives a markup
     * @return qACFee amount of AC used to pay fee
     * @return qTCMinted amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTCtoViaVendor(
        address tp_,
        uint256 qTP_,
        uint256 qTCmin_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 qACFee, uint256 qTCMinted, uint256 qFeeToken) {
        SwapTPforTCParams memory params = SwapTPforTCParams({
            tp: tp_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        (qACFee, qTCMinted, qFeeToken, ) = _swapTPforTCto(params, msg.sender);
    }

    /**
     * @notice caller sends Collateral Token and receives Pegged Token
     * @param tp_ Pegged Token address
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that the sender expects to receive
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTCforTP(
        address tp_,
        uint256 qTC_,
        uint256 qTPmin_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTCforTPParams memory params = SwapTCforTPParams({
            tp: tp_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: address(0)
        });
        (qACFee, qTPMinted, qFeeToken, ) = _swapTCforTPto(params, msg.sender);
    }

    /**
     * @notice caller sends Collateral Token and receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tp_ Pegged Token address
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that the sender expects to receive
     * @param vendor_ address who receives a markup
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTCforTPViaVendor(
        address tp_,
        uint256 qTC_,
        uint256 qTPmin_,
        address vendor_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTCforTPParams memory params = SwapTCforTPParams({
            tp: tp_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
        });
        (qACFee, qTPMinted, qFeeToken, ) = _swapTCforTPto(params, msg.sender);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Pegged Token
     * @param tp_ Pegged Token address
     * @param qTC_ amount of Collateral to swap
     * @param qTPmin_ minimum amount of Pegged Token that `recipient_` expects to receive
     * @param recipient_ address who receives the Pegged Token
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTCforTPto(
        address tp_,
        uint256 qTC_,
        uint256 qTPmin_,
        address recipient_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTCforTPParams memory params = SwapTCforTPParams({
            tp: tp_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_,
            vendor: address(0)
        });
        (qACFee, qTPMinted, qFeeToken, ) = _swapTCforTPto(params, msg.sender);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Pegged Token
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param tp_ Pegged Token address
     * @param qTC_ amount of Collateral to swap
     * @param qTPmin_ minimum amount of Pegged Token that `recipient_` expects to receive
     * @param recipient_ address who receives the Pegged Token
     * @param vendor_ address who receives a markup
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTCforTPtoViaVendor(
        address tp_,
        uint256 qTC_,
        uint256 qTPmin_,
        address recipient_,
        address vendor_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTCforTPParams memory params = SwapTCforTPParams({
            tp: tp_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
        });
        (qACFee, qTPMinted, qFeeToken, ) = _swapTCforTPto(params, msg.sender);
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
