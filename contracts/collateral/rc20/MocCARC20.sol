pragma solidity ^0.8.16;

import "../../core/MocCore.sol";

/**
 * @title MocCARC20: Moc Collateral Asset RC20
 * @notice Moc protocol implementation using a RC20 as Collateral Asset.
 */
contract MocCARC20 is MocCore {
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
     * @dev this function must be execute by the AC implementation at initialization
     * @param governor_ The address that will define when a change contract is authorized
     * @param stopper_ The address that is authorized to pause this contract
     * @param acTokenAddress_ Collateral Asset Token contract address
     * @param tcTokenAddress_ Collateral Token contract address
     * @param mocFeeFlowAddress_ Moc Fee Flow contract address
     * @param ctarg_ global target coverage of the model [PREC]
     * @param protThrld_ protected state threshold [PREC]
     * @param tcMintFee_ fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
     * @param tcRedeemFee_ fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
     * @param emaCalculationBlockSpan_ amount of blocks to wait between Peeged ema calculation
     */
    function initialize(
        IGovernor governor_,
        address stopper_,
        address acTokenAddress_,
        address tcTokenAddress_,
        address mocFeeFlowAddress_,
        uint256 ctarg_,
        uint256 protThrld_,
        uint256 tcMintFee_,
        uint256 tcRedeemFee_,
        uint256 emaCalculationBlockSpan_
    ) external initializer {
        if (acTokenAddress_ == address(0)) revert InvalidAddress();
        acToken = IMocRC20(acTokenAddress_);
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
    function acTransfer(address to_, uint256 amount_) internal override {
        if (amount_ > 0) {
            SafeERC20.safeTransfer(acToken, to_, amount_);
        }
    }

    // ------- External Functions -------

    /**
     * @notice caller sends Collateral Asset and receives Collateral Token
        Requires prior sender approval of Collateral Asset to this contract 
     * @param qTC_ amount of Collateral Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @return qACtotalNeeded amount of qAC used to mint qTC
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
     * @return qACtotalNeeded amount of qAC used to mint qTC
     */
    function mintTCto(
        uint256 qTC_,
        uint256 qACmax_,
        address recipient_
    ) external returns (uint256 qACtotalNeeded) {
        SafeERC20.safeTransferFrom(acToken, msg.sender, address(this), qACmax_);
        return _mintTCto(qTC_, qACmax_, msg.sender, recipient_);
    }

    /**
     * @notice caller sends Collateral Asset and receives Pegged Token
        Requires prior sender approval of Collateral Asset to this contract 
     * @param i_ Pegged Token index to mint
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @return qACtotalNeeded amount of qAC used to mint qTP
     */
    function mintTP(
        uint8 i_,
        uint256 qTP_,
        uint256 qACmax_
    ) external returns (uint256 qACtotalNeeded) {
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
     * @return qACtotalNeeded amount of qAC used to mint qTP
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
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
