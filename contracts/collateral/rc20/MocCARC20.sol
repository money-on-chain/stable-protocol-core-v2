pragma solidity ^0.8.16;

import "../../core/MocCore.sol";

/**
 * @title MocCARC20: Moc Collateral Asset RC20
 * @notice Moc protocol implementation using a RC20 as Collateral Asset.
 */
contract MocCARC20 is MocCore {
    // ------- Structs -------
    struct InitializeParams {
        InitializeCoreParams initializeCoreParams;
        // Collateral Asset Token contract address
        address acTokenAddress;
    }

    // ------- Storage -------
    // Collateral Asset token
    IMocRC20 private acToken;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param initializeParams_ contract initializer params
     * @dev governorAddress The address that will define when a change contract is authorized
     *      stopperAddress The address that is authorized to pause this contract
     *      acTokenAddress Collateral Asset Token contract address
     *      tcTokenAddress Collateral Token contract address
     *      mocSettlementAddress MocSettlement contract address
     *      mocFeeFlowAddress Moc Fee Flow contract address
     *      mocInterestCollectorAddress mocInterestCollector address
     *      mocTurboAddress mocTurbo address
     *      protThrld protected state threshold [PREC]
     *      liqThrld liquidation coverage threshold [PREC]
     *      tcMintFee fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
     *      tcRedeemFee fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
     *      sf proportion of the devaluation that is transferred to MoC Fee Flow during the settlement [PREC]
     *      fa proportion of the devaluation that is returned to Turbo during the settlement [PREC]
     *      emaCalculationBlockSpan amount of blocks to wait between Pegged ema calculation
     */
    function initialize(InitializeParams calldata initializeParams_) external initializer {
        if (initializeParams_.acTokenAddress == address(0)) revert InvalidAddress();
        acToken = IMocRC20(initializeParams_.acTokenAddress);
        __MocCore_init(initializeParams_.initializeCoreParams);
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

    // ------- External Functions -------

    /**
     * @notice caller sends Collateral Asset and receives Collateral Token
        Requires prior sender approval of Collateral Asset to this contract 
     * @param qTC_ amount of Collateral Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @return qACtotalNeeded amount of AC used to mint qTC
     */
    function mintTC(uint256 qTC_, uint256 qACmax_) external returns (uint256 qACtotalNeeded) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _mintTCto(qTC_, qACmax_, msg.sender, msg.sender, true);
    }

    /**
     * @notice caller sends Collateral Asset and recipient receives Collateral Token
        Requires prior sender approval of Collateral Asset to this contract 
     * @param qTC_ amount of Collateral Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param recipient_ address who receives the Collateral Token
     * @return qACtotalNeeded amount of AC used to mint qTC
     */
    function mintTCto(
        uint256 qTC_,
        uint256 qACmax_,
        address recipient_
    ) external returns (uint256 qACtotalNeeded) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _mintTCto(qTC_, qACmax_, msg.sender, recipient_, true);
    }

    /**
     * @notice caller sends Collateral Token and receives Collateral Asset
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @return qACtoRedeem amount of AC sent to sender
     */
    function redeemTC(uint256 qTC_, uint256 qACmin_) external returns (uint256 qACtoRedeem) {
        return _redeemTCto(qTC_, qACmin_, msg.sender, msg.sender, true);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Collateral Asset
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
        return _redeemTCto(qTC_, qACmin_, msg.sender, recipient_, true);
    }

    /**
     * @notice caller sends Collateral Asset and receives Pegged Token
        Requires prior sender approval of Collateral Asset to this contract 
     * @param i_ Pegged Token index to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @return qACtotalNeeded amount of AC used to mint qTP
     */
    function mintTP(
        uint8 i_,
        uint256 qTP_,
        uint256 qACmax_
    ) external returns (uint256 qACtotalNeeded) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _mintTPto(i_, qTP_, qACmax_, msg.sender, msg.sender, true);
    }

    /**
     * @notice caller sends Collateral Asset and recipient receives Pegged Token
        Requires prior sender approval of Collateral Asset to this contract 
     * @param i_ Pegged Token index to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param recipient_ address who receives the Pegged Token
     * @return qACtotalNeeded amount of AC used to mint qTP
     */
    function mintTPto(
        uint8 i_,
        uint256 qTP_,
        uint256 qACmax_,
        address recipient_
    ) external returns (uint256 qACtotalNeeded) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _mintTPto(i_, qTP_, qACmax_, msg.sender, recipient_, true);
    }

    /**
     * @notice caller sends Pegged Token and receives Collateral Asset
     * @param i_ Pegged Token index to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @return qACtoRedeem amount of AC sent to sender
     */
    function redeemTP(
        uint8 i_,
        uint256 qTP_,
        uint256 qACmin_
    ) external returns (uint256 qACtoRedeem) {
        return _redeemTPto(i_, qTP_, qACmin_, msg.sender, msg.sender, true);
    }

    /**
     * @notice caller sends Pegged Token and recipient receives Collateral Asset
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
        return _redeemTPto(i_, qTP_, qACmin_, msg.sender, recipient_, true);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
