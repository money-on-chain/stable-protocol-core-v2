pragma solidity ^0.8.17;

import "../../core/MocCore.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/**
 * @title MocCACoinbase: Moc Collateral Asset Coinbase
 * @notice Moc protocol implementation using network Coinbase as Collateral Asset
 */
contract MocCACoinbase is MocCore, ReentrancyGuardUpgradeable {
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
     *      mocSettlementAddress MocSettlement contract address
     *      mocFeeFlowAddress Moc Fee Flow contract address
     *      mocInterestCollectorAddress mocInterestCollector address
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

    // ------- External Functions -------

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Collateral Token
     * @dev any extra value, not spent on TC nor fees, will be return to sender
     * @param qTC_ amount of Collateral Token to mint
     * @return qACtotalNeeded amount of AC used to mint qTC
     */
    function mintTC(uint256 qTC_) external payable returns (uint256 qACtotalNeeded) {
        return _mintTCto(qTC_, msg.value, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and recipient receives Collateral Token
     * @dev any extra value, not spent on TC nor fees, will be return to sender
     * @param qTC_ amount of Collateral Token to mint
     * @param recipient_ address who receives the Collateral Token
     * @return qACtotalNeeded amount of AC used to mint qTC
     */
    function mintTCto(uint256 qTC_, address recipient_) external payable returns (uint256 qACtotalNeeded) {
        return _mintTCto(qTC_, msg.value, msg.sender, recipient_);
    }

    /**
     * @notice caller sends Collateral Token and receives coinbase as Collateral Asset
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @return qACtoRedeem amount of AC sent to sender
     */
    function redeemTC(uint256 qTC_, uint256 qACmin_) external returns (uint256 qACtoRedeem) {
        return _redeemTCto(qTC_, qACmin_, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives coinbase as Collateral Asset
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @return qACtoRedeem amount of AC sent to 'recipient_'
     */
    function redeemTCto(uint256 qTC_, uint256 qACmin_, address recipient_) external returns (uint256 qACtoRedeem) {
        return _redeemTCto(qTC_, qACmin_, msg.sender, recipient_);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and receives Pegged Token
     * @dev any extra value, not spent on TP nor fees, will be return to sender
     * @param i_ Pegged Token index to mint
     * @param qTP_ amount of Pegged Token to mint
     * @return qACtotalNeeded amount of AC used to mint qTP
     */
    function mintTP(uint8 i_, uint256 qTP_) external payable returns (uint256 qACtotalNeeded) {
        return _mintTPto(i_, qTP_, msg.value, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends coinbase as Collateral Asset and recipient receives Pegged Token
     * @dev any extra value, not spent on TP nor fees, will be return to sender
     * @param i_ Pegged Token index to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param recipient_ address who receives the Pegged Token
     * @return qACtotalNeeded amount of AC used to mint qTP
     */
    function mintTPto(uint8 i_, uint256 qTP_, address recipient_) external payable returns (uint256 qACtotalNeeded) {
        return _mintTPto(i_, qTP_, msg.value, msg.sender, recipient_);
    }

    /**
     * @notice caller sends Pegged Token and receives coinbase as Collateral Asset
     * @param i_ Pegged Token index to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @return qACtoRedeem amount of AC sent to sender
     */
    function redeemTP(uint8 i_, uint256 qTP_, uint256 qACmin_) external returns (uint256 qACtoRedeem) {
        return _redeemTPto(i_, qTP_, qACmin_, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends Pegged Token and recipient receives coinbase as Collateral Asset
     * @param i_ Pegged Token index to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @return qACtoRedeem amount of AC sent to 'recipient_'
     */
    function redeemTPto(
        uint8 i_,
        uint256 qTP_,
        uint256 qACmin_,
        address recipient_
    ) external returns (uint256 qACtoRedeem) {
        return _redeemTPto(i_, qTP_, qACmin_, msg.sender, recipient_);
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
     */
    function mintTCandTP(uint8 i_, uint256 qTP_) external payable returns (uint256 qACtotalNeeded, uint256 qTCtoMint) {
        return _mintTCandTPto(i_, qTP_, msg.value, msg.sender, msg.sender);
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
     */
    function mintTCandTPto(
        uint8 i_,
        uint256 qTP_,
        address recipient_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qTCtoMint) {
        return _mintTCandTPto(i_, qTP_, msg.value, msg.sender, recipient_);
    }

    /**
     * @notice caller sends Collateral Token and Pegged Token and receives coinbase as Collateral Asset
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param i_ Pegged Token index
     * @param qTC_ maximum amount of Collateral Token to redeem
     * @param qTP_ maximum amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that the sender expects to receive
     * @return qACtoRedeem amount of AC sent to the sender
     * @return qTPtoRedeem amount of Pegged Token redeemed
     */
    function redeemTCandTP(
        uint8 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACmin_
    ) external returns (uint256 qACtoRedeem, uint256 qTPtoRedeem) {
        return _redeemTCandTPto(i_, qTC_, qTP_, qACmin_, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends Collateral Token and Pegged Token and recipient receives coinbase as Collateral Asset
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param i_ Pegged Token index
     * @param qTC_ maximum amount of Collateral Token to redeem
     * @param qTP_ maximum amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @return qACtoRedeem amount of AC sent to the `recipient_`
     * @return qTPtoRedeem amount of Pegged Token redeemed
     */
    function redeemTCandTPto(
        uint8 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACmin_,
        address recipient_
    ) external returns (uint256 qACtoRedeem, uint256 qTPtoRedeem) {
        return _redeemTCandTPto(i_, qTC_, qTP_, qACmin_, msg.sender, recipient_);
    }

    /**
     * @notice caller sends a Pegged Token and receives another one
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that the sender expects to receive
     * @return qACtotalNeeded amount of AC used to pay fee and interest
     */
    function swapTPforTP(
        uint8 iFrom_,
        uint8 iTo_,
        uint256 qTP_,
        uint256 qTPmin_
    ) external payable returns (uint256 qACtotalNeeded) {
        return _swapTPforTPto(iFrom_, iTo_, qTP_, qTPmin_, msg.value, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives another one
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param recipient_ address who receives the target Pegged Token
     * @return qACtotalNeeded amount of AC used to pay fee and interest
     */
    function swapTPforTPto(
        uint8 iFrom_,
        uint8 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        address recipient_
    ) external payable returns (uint256 qACtotalNeeded) {
        return _swapTPforTPto(iFrom_, iTo_, qTP_, qTPmin_, msg.value, msg.sender, recipient_);
    }

    /**
     * @notice allow to send Coinbase to increment the Collateral Asset in the protocol
     */
    receive() external payable {
        nACcb += msg.value;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
