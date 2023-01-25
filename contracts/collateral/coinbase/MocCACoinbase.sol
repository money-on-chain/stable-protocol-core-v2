// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import "../../core/MocCore.sol";

/**
 * @title MocCACoinbase: Moc Collateral Asset Coinbase
 * @notice Moc protocol implementation using network Coinbase as Collateral Asset
 */
contract MocCACoinbase is MocCore {
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
     *      emaCalculationBlockSpan amount of blocks to wait between Pegged ema calculation
     *      bes number of blocks between settlements
     */
    function initialize(InitializeCoreParams calldata initializeCoreParams_) external initializer {
        __MocCore_init(initializeCoreParams_);
    }

    // ------- Internal Functions -------

    /**
     * @inheritdoc MocCore
     */
    function acTransfer(address to_, uint256 amount_) internal override nonReentrant {
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
            recipient: msg.sender
        });
        return _mintTCto(params);
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
            recipient: recipient_
        });
        return _mintTCto(params);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Pegged Token
     * @dev any extra value, not spent on TP nor fees, will be return to sender
     * @param i_ Pegged Token index to mint
     * @param qTP_ amount of Pegged Token to mint
     * @return qACtotalNeeded amount of AC used to mint qTP
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTP(uint8 i_, uint256 qTP_) external payable returns (uint256 qACtotalNeeded, uint256 qFeeToken) {
        MintTPParams memory params = MintTPParams({
            i: i_,
            qTP: qTP_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender
        });
        return _mintTPto(params);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and recipient receives Pegged Token
     * @dev any extra value, not spent on TP nor fees, will be return to sender
     * @param i_ Pegged Token index to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param recipient_ address who receives the Pegged Token
     * @return qACtotalNeeded amount of AC used to mint qTP
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTPto(
        uint8 i_,
        uint256 qTP_,
        address recipient_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qFeeToken) {
        MintTPParams memory params = MintTPParams({
            i: i_,
            qTP: qTP_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_
        });
        return _mintTPto(params);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Collateral Token and Pegged Token
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint
     * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
     * @return qTCtoMint amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTCandTP(
        uint8 i_,
        uint256 qTP_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qTCtoMint, uint256 qFeeToken) {
        MintTCandTPParams memory params = MintTCandTPParams({
            i: i_,
            qTP: qTP_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender
        });
        return _mintTCandTPto(params);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and recipient receives Collateral Token and Pegged Token
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint
     * @param recipient_ address who receives the Collateral Token and Pegged Token
     * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
     * @return qTCtoMint amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function mintTCandTPto(
        uint8 i_,
        uint256 qTP_,
        address recipient_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qTCtoMint, uint256 qFeeToken) {
        MintTCandTPParams memory params = MintTCandTPParams({
            i: i_,
            qTP: qTP_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_
        });
        return _mintTCandTPto(params);
    }

    /**
     * @notice caller sends a Pegged Token and receives another one
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that the sender expects to receive
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTP(
        uint8 iFrom_,
        uint8 iTo_,
        uint256 qTP_,
        uint256 qTPmin_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTPforTPParams memory params = SwapTPforTPParams({
            iFrom: iFrom_,
            iTo: iTo_,
            qTP: qTP_,
            qTPmin: qTPmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender
        });
        return _swapTPforTPto(params);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives another one
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param recipient_ address who receives the target Pegged Token
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTPto(
        uint8 iFrom_,
        uint8 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        address recipient_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTPforTPParams memory params = SwapTPforTPParams({
            iFrom: iFrom_,
            iTo: iTo_,
            qTP: qTP_,
            qTPmin: qTPmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_
        });
        return _swapTPforTPto(params);
    }

    /**
     * @notice caller sends a Pegged Token and receives Collateral Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that the sender expects to receive
     * @return qACFee amount of AC used to pay fee
     * @return qTCMinted amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTC(
        uint8 i_,
        uint256 qTP_,
        uint256 qTCmin_
    ) external payable returns (uint256 qACFee, uint256 qTCMinted, uint256 qFeeToken) {
        SwapTPforTCParams memory params = SwapTPforTCParams({
            i: i_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender
        });
        return _swapTPforTCto(params);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Collateral Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Token
     * @return qACFee amount of AC used to pay fee
     * @return qTCMinted amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTPforTCto(
        uint8 i_,
        uint256 qTP_,
        uint256 qTCmin_,
        address recipient_
    ) external payable returns (uint256 qACFee, uint256 qTCMinted, uint256 qFeeToken) {
        SwapTPforTCParams memory params = SwapTPforTCParams({
            i: i_,
            qTP: qTP_,
            qTCmin: qTCmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_
        });
        return _swapTPforTCto(params);
    }

    /**
     * @notice caller sends Collateral Token and receives Pegged Token
     * @param i_ Pegged Token index
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that the sender expects to receive
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTCforTP(
        uint8 i_,
        uint256 qTC_,
        uint256 qTPmin_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTCforTPParams memory params = SwapTCforTPParams({
            i: i_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: msg.sender
        });
        return _swapTCforTPto(params);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Pegged Token
     * @param i_ Pegged Token index
     * @param qTC_ amount of Collateral to swap
     * @param qTPmin_ minimum amount of Pegged Token that `recipient_` expects to receive
     * @param recipient_ address who receives the Pegged Token
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function swapTCforTPto(
        uint8 i_,
        uint256 qTC_,
        uint256 qTPmin_,
        address recipient_
    ) external payable returns (uint256 qACFee, uint256 qTPMinted, uint256 qFeeToken) {
        SwapTCforTPParams memory params = SwapTCforTPParams({
            i: i_,
            qTC: qTC_,
            qTPmin: qTPmin_,
            qACmax: msg.value,
            sender: msg.sender,
            recipient: recipient_
        });
        return _swapTCforTPto(params);
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
    uint256[50] private __gap;
}
