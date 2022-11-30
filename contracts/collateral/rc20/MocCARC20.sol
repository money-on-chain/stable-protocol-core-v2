pragma solidity ^0.8.17;

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
    IERC20 private acToken;

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
     *      emaCalculationBlockSpan amount of blocks to wait between Pegged ema calculation
     */
    function initialize(InitializeParams calldata initializeParams_) external initializer {
        acToken = IERC20(initializeParams_.acTokenAddress);
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
        return _mintTCto(qTC_, qACmax_, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends Collateral Asset and recipient receives Collateral Token
        Requires prior sender approval of Collateral Asset to this contract 
     * @param qTC_ amount of Collateral Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param recipient_ address who receives the Collateral Token
     * @return qACtotalNeeded amount of AC used to mint qTC
     */
    function mintTCto(uint256 qTC_, uint256 qACmax_, address recipient_) external returns (uint256 qACtotalNeeded) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _mintTCto(qTC_, qACmax_, msg.sender, recipient_);
    }

    /**
     * @notice caller sends Collateral Asset and receives Pegged Token
        Requires prior sender approval of Collateral Asset to this contract 
     * @param i_ Pegged Token index to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @return qACtotalNeeded amount of AC used to mint qTP
     */
    function mintTP(uint8 i_, uint256 qTP_, uint256 qACmax_) external returns (uint256 qACtotalNeeded) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _mintTPto(i_, qTP_, qACmax_, msg.sender, msg.sender);
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
        return _mintTPto(i_, qTP_, qACmax_, msg.sender, recipient_);
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
     * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
     * @return qTCtoMint amount of Collateral Token minted
     */
    function mintTCandTP(
        uint8 i_,
        uint256 qTP_,
        uint256 qACmax_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qTCtoMint) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _mintTCandTPto(i_, qTP_, qACmax_, msg.sender, msg.sender);
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
     * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
     * @return qTCtoMint amount of Collateral Token minted
     */
    function mintTCandTPto(
        uint8 i_,
        uint256 qTP_,
        uint256 qACmax_,
        address recipient_
    ) external payable returns (uint256 qACtotalNeeded, uint256 qTCtoMint) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _mintTCandTPto(i_, qTP_, qACmax_, msg.sender, recipient_);
    }

    /**
     * @notice caller sends a Pegged Token and receives another one
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that the sender expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     */
    function swapTPforTP(
        uint8 iFrom_,
        uint8 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qACmax_
    ) external returns (uint256 qACFee, uint256 qTPMinted) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _swapTPforTPto(iFrom_, iTo_, qTP_, qTPmin_, qACmax_, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives another one
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @param recipient_ address who receives the target Pegged Token
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     */
    function swapTPforTPto(
        uint8 iFrom_,
        uint8 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qACmax_,
        address recipient_
    ) external returns (uint256 qACFee, uint256 qTPMinted) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _swapTPforTPto(iFrom_, iTo_, qTP_, qTPmin_, qACmax_, msg.sender, recipient_);
    }

    /**
     * @notice caller sends a Pegged Token and receives Collateral Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that the sender expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Collateral Token minted
     */
    function swapTPforTC(
        uint8 i_,
        uint256 qTP_,
        uint256 qTCmin_,
        uint256 qACmax_
    ) external returns (uint256 qACFee, uint256 qTPMinted) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _swapTPforTCto(i_, qTP_, qTCmin_, qACmax_, msg.sender, msg.sender);
    }

    /**
     * @notice caller sends a Pegged Token and recipient receives Collateral Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @param recipient_ address who receives the Collateral Token
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Collateral Token minted
     */
    function swapTPforTCto(
        uint8 i_,
        uint256 qTP_,
        uint256 qTCmin_,
        uint256 qACmax_,
        address recipient_
    ) external returns (uint256 qACFee, uint256 qTPMinted) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _swapTPforTCto(i_, qTP_, qTCmin_, qACmax_, msg.sender, recipient_);
    }

    /**
     * @notice caller sends Collateral Token and receives Pegged Token
     * @param i_ Pegged Token index
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token that the sender expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @return qACFee amount of AC used to pay fee
     * @return qTPMinted amount of Pegged Token minted
     */
    function swapTCforTP(
        uint8 i_,
        uint256 qTC_,
        uint256 qTPmin_,
        uint256 qACmax_
    ) external returns (uint256 qACFee, uint256 qTPMinted) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _swapTCforTPto(i_, qTC_, qTPmin_, qACmax_, msg.sender, msg.sender);
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
     */
    function swapTCforTPto(
        uint8 i_,
        uint256 qTC_,
        uint256 qTPmin_,
        uint256 qACmax_,
        address recipient_
    ) external returns (uint256 qACFee, uint256 qTPMinted) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _swapTCforTPto(i_, qTC_, qTPmin_, qACmax_, msg.sender, recipient_);
    }

    /**
     * @notice Refreshes the AC holdings for the Bucket
     * @dev Intended to be use as notification after an RC20 AC transfer to this contract
     */
    function refreshACBalance() external {
        // On this implementation, AC token balance has full correlation with nACcb
        if (acBalanceOf(address(this)) - nACcb > 0) _depositAC(acBalanceOf(address(this)) - nACcb);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
