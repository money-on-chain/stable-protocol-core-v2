pragma solidity ^0.8.16;

import "../interfaces/IMocRC20.sol";
import "./MocEma.sol";

/**
 * @title MocCore
 * @notice MocCore nucleats all the basic MoC functionality and toolset. It allows Collateral
 * asset aware contracts to implement the main mint/redeem operations.
 */
abstract contract MocCore is MocEma {
    // ------- Events -------
    event TCMinted(address indexed sender_, address indexed recipient_, uint256 qTC_, uint256 qAC_);
    event TPMinted(uint8 indexed i_, address indexed sender_, address indexed recipient_, uint256 qTP_, uint256 qAC_);
    event PeggedTokenAdded(
        address indexed tpTokenAddress_,
        address priceProviderAddress_,
        uint256 tpR_,
        uint256 tpBmin_,
        uint256 tpMintFee_,
        uint256 tpRedeemFee_,
        uint256 tpEma_,
        uint256 tpEmaSf_
    );
    // ------- Custom Errors -------
    error LowCoverage(uint256 cglb_, uint256 protThrld_);
    error InsufficientQacSent(uint256 qACsent_, uint256 qACNeeded_);
    error InsufficientTPtoMint(uint256 qTP_, uint256 tpAvailableToMint_);

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @dev this function must be execute by the AC implementation at initialization
     * @param governor_ The address that will define when a change contract is authorized
     * @param stopper_ The address that is authorized to pause this contract
     * @param tcTokenAddress_ Collateral Token contract address
     * @param mocFeeFlowAddress_ Moc Fee Flow contract address
     * @param ctarg_ global target coverage of the model [PREC]
     * @param protThrld_ protected state threshold [PREC]
     * @param tcMintFee_ fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
     * @param tcRedeemFee_ fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
     */
    function __MocCore_init(
        IGovernor governor_,
        address stopper_,
        address tcTokenAddress_,
        address mocFeeFlowAddress_,
        uint256 ctarg_,
        uint256 protThrld_,
        uint256 tcMintFee_,
        uint256 tcRedeemFee_
    ) internal onlyInitializing {
        __MocUpgradable_init(governor_, stopper_);
        __MocBaseBucket_init_unchained(
            tcTokenAddress_,
            mocFeeFlowAddress_,
            ctarg_,
            protThrld_,
            tcMintFee_,
            tcRedeemFee_
        );
        __MocEma_init_unchained();
    }

    // ------- Internal Functions -------

    /**
     * @notice transfer Collateral Asset
     * @dev this function must be overriden by the AC implementation
     * @param to_ address who receives the Collateral Asset
     * @param amount_ amount of Collateral Asset to transfer
     */
    function acTransfer(address to_, uint256 amount_) internal virtual;

    /**
     * @notice mint Collateral Token in exchange for Collateral Asset
     * @param qTC_ amount of Collateral Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param sender_ address who sends the Collateral Asset, all unspent amount is returned to it
     * @param recipient_ address who receives the Collateral Token
     * @return qACtotalNeeded amount of qAC used to mint qTC
     */
    function _mintTCto(
        uint256 qTC_,
        uint256 qACmax_,
        address sender_,
        address recipient_
    ) internal returns (uint256 qACtotalNeeded) {
        // calculate how many qAC are needed to mint TC and the qAC fee
        (uint256 qACNeededtoMint, uint256 qACfee) = _calcQACforMintTC(qTC_);
        qACtotalNeeded = qACNeededtoMint + qACfee;
        if (qACtotalNeeded > qACmax_) revert InsufficientQacSent(qACmax_, qACtotalNeeded);
        // add qTC and qAC to the Bucket
        _depositTC(qTC_, qACNeededtoMint);
        // mint qTC to the recipient
        tcToken.mint(recipient_, qTC_);
        // calculate how many qAC should be returned to the sender
        uint256 qACchg = qACmax_ - qACtotalNeeded;
        // transfer the qAC change to the sender
        acTransfer(sender_, qACchg);
        // transfer qAC fees to Fee Flow
        acTransfer(mocFeeFlowAddress, qACfee);
        emit TCMinted(sender_, recipient_, qTC_, qACtotalNeeded);
        return qACtotalNeeded;
    }

    /**
     * @notice mint Pegged Token in exchange for Collateral Asset
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param sender_ address who sends the Collateral Asset, all unspent amount is returned to it
     * @param recipient_ address who receives the Pegged Token
     * @return qACtotalNeeded amount of qAC used to mint qTP
     */
    function _mintTPto(
        uint8 i_,
        uint256 qTP_,
        uint256 qACmax_,
        address sender_,
        address recipient_
    ) internal returns (uint256 qACtotalNeeded) {
        // calculate how many qAC are needed to mint TP and the qAC fee
        (uint256 qACNeededtoMint, uint256 qACfee) = _calcQACforMintTP(i_, qTP_);
        qACtotalNeeded = qACNeededtoMint + qACfee;
        if (qACtotalNeeded > qACmax_) revert InsufficientQacSent(qACmax_, qACtotalNeeded);
        // add qTP and qAC to the Bucket
        _depositTP(i_, qTP_, qACNeededtoMint);
        // mint qTP to the recipient
        tpToken[i_].mint(recipient_, qTP_);
        // calculate how many qAC should be returned to the sender
        uint256 qACchg = qACmax_ - qACtotalNeeded;
        // transfer the qAC change to the sender
        acTransfer(sender_, qACchg);
        // transfer qAC fees to Fee Flow
        acTransfer(mocFeeFlowAddress, qACfee);
        emit TPMinted(i_, sender_, recipient_, qTP_, qACtotalNeeded);
        return qACtotalNeeded;
    }

    // ------- Public Functions -------

    /**
     * @notice add a Pegged Token to the protocol
     * TODO: this function should be called only through governance system
     * @param tpTokenAddress_ Pegged Token contract address to add
     * @param priceProviderAddress_ Pegged Token price provider contract address
     * @param tpR_ Pegged Token reserve factor [PREC]
     * @param tpBmin_ Pegged Token minimum amount of blocks until the settlement to charge interest for redeem [N]
     * @param tpMintFee_ fee pct sent to Fee Flow for mint [PREC]
     * @param tpRedeemFee_ fee pct sent to Fee Flow for redeem [PREC]
     * @param tpEma_ initial Pegged Token exponential moving average [PREC]
     * @param tpEmaSf_ Pegged Token smoothing factor [PREC]
     */
    function addPeggedToken(
        address tpTokenAddress_,
        address priceProviderAddress_,
        uint256 tpR_,
        uint256 tpBmin_,
        uint256 tpMintFee_,
        uint256 tpRedeemFee_,
        uint256 tpEma_,
        uint256 tpEmaSf_
    ) public {
        if (tpTokenAddress_ == address(0)) revert InvalidAddress();
        if (priceProviderAddress_ == address(0)) revert InvalidAddress();
        if (tpMintFee_ > PRECISION) revert InvalidValue();
        if (tpRedeemFee_ > PRECISION) revert InvalidValue();
        if (tpEmaSf_ >= ONE) revert InvalidValue();
        // set Pegged Token address
        tpToken.push(IMocRC20(tpTokenAddress_));
        // set peg container item
        pegContainer.push(PegContainerItem({ nTP: 0, nTPXV: 0, priceProvider: IPriceProvider(priceProviderAddress_) }));
        // set reserve factor
        tpR.push(tpR_);
        // set minimum amount of blocks
        tpBmin.push(tpBmin_);
        // set mint fee pct
        tpMintFee.push(tpMintFee_);
        // set redeem fee pct
        tpRedeemFee.push(tpRedeemFee_);
        // set EMA initial value and smoothing factor
        tpEma.push(EmaItem({ ema: tpEma_, sf: tpEmaSf_ }));
        emit PeggedTokenAdded(
            tpTokenAddress_,
            priceProviderAddress_,
            tpR_,
            tpBmin_,
            tpMintFee_,
            tpRedeemFee_,
            tpEma_,
            tpEmaSf_
        );
    }

    /**
     * @notice calculate how many Collateral Asset are needed to mint an amount of Collateral Token
     * @param qTC_ amount of Collateral Token to mint
     * @return qACNeededtoMint amount of Collateral Asset needed to mint [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function _calcQACforMintTC(uint256 qTC_) internal view returns (uint256 qACNeededtoMint, uint256 qACfee) {
        if (qTC_ == 0) revert InvalidValue();
        uint256 lckAC = getLckAC();
        uint256 cglb = _getCglb(lckAC);
        // check coverage is above the protected threshold
        if (cglb <= protThrld) revert LowCoverage(cglb, protThrld);
        // calculate how many qAC are needed to mint TC
        // [N] = [N] * [PREC] / [PREC]
        qACNeededtoMint = (qTC_ * _getPTCac(lckAC)) / PRECISION;
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = (qACNeededtoMint * tcMintFee) / PRECISION;

        return (qACNeededtoMint, qACfee);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to mint an amount of Pegged Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint
     * @return qACNeededtoMint amount of Collateral Asset needed to mint [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function _calcQACforMintTP(uint8 i_, uint256 qTP_) internal view returns (uint256 qACNeededtoMint, uint256 qACfee) {
        if (qTP_ == 0) revert InvalidValue();
        uint256 lckAC = getLckAC();
        uint256 cglb = _getCglb(lckAC);
        uint256 pTPac = _getPTPac(i_);
        uint256 ctargemaTP = getCtargemaTP(i_, pTPac);

        // check if coverage is above the target coverage adjusted by the moving average
        if (cglb <= ctargemaTP) revert LowCoverage(cglb, ctargemaTP);

        uint256 ctargemaCA = getCtargemaCA();
        uint256 tpAvailableToMint = _getTPAvailableToMint(ctargemaCA, pTPac, lckAC);

        // check if there are enough TP available to mint
        if (tpAvailableToMint <= qTP_) revert InsufficientTPtoMint(qTP_, tpAvailableToMint);

        // calculate how many qAC are needed to mint TP
        // [N] = [N] * [PREC] / [PREC]
        qACNeededtoMint = (qTP_ * pTPac) / PRECISION;
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = (qACNeededtoMint * tpMintFee[i_]) / PRECISION;
        return (qACNeededtoMint, qACfee);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
