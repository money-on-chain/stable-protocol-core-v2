pragma solidity ^0.8.16;

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
     * @param governor_ The address that will define when a change contract is authorized
     * @param stopper_ The address that is authorized to pause this contract
     * @param tcTokenAddress_ Collateral Token contract address
     * @param mocFeeFlowAddress_ Moc Fee Flow contract address
     * @param ctarg_ global target coverage of the model [PREC]
     * @param protThrld_ protected state threshold [PREC]
     * @param tcMintFee_ fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
     * @param tcRedeemFee_ fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
     * @param emaCalculationBlockSpan_ amount of blocks to wait between Pegged ema calculation
     */
    function initialize(
        IGovernor governor_,
        address stopper_,
        address tcTokenAddress_,
        address mocFeeFlowAddress_,
        uint256 ctarg_,
        uint256 protThrld_,
        uint256 tcMintFee_,
        uint256 tcRedeemFee_,
        uint256 emaCalculationBlockSpan_
    ) external initializer {
        __MocCore_init(
            governor_,
            stopper_,
            tcTokenAddress_,
            mocFeeFlowAddress_,
            ctarg_,
            protThrld_,
            tcMintFee_,
            tcRedeemFee_,
            emaCalculationBlockSpan_
        );
    }

    // ------- Internal Functions -------

    /**
     * @notice transfer Collateral Asset
     * @param to_ address who receives the Collateral Asset
     * @param amount_ amount of Collateral Asset to transfer
     */
    function acTransfer(address to_, uint256 amount_) internal override nonReentrant {
        if (amount_ > 0) {
            if (to_ == address(0)) revert InvalidAddress();
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, ) = to_.call{ value: amount_ }("");
            if (!success) revert TransferFailed();
        }
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
    function redeemTCto(
        uint256 qTC_,
        uint256 qACmin_,
        address recipient_
    ) external returns (uint256 qACtoRedeem) {
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
    function mintTPto(
        uint8 i_,
        uint256 qTP_,
        address recipient_
    ) external payable returns (uint256 qACtotalNeeded) {
        return _mintTPto(i_, qTP_, msg.value, msg.sender, recipient_);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
