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
    event TCRedeemed(address indexed sender_, address indexed recipient_, uint256 qTC_, uint256 qAC_);
    event TPMinted(uint8 indexed i_, address indexed sender_, address indexed recipient_, uint256 qTP_, uint256 qAC_);
    event PeggedTokenAdded(
        uint8 indexed i_,
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
    error PeggedTokenAlreadyAdded();
    error InsufficientQacSent(uint256 qACsent_, uint256 qACNeeded_);
    error QacBelowMinimumRequired(uint256 qACmin_, uint256 qACtoRedeem_);
    error InsufficientTPtoMint(uint256 qTP_, uint256 tpAvailableToMint_);
    error InsufficientTCtoRedeem(uint256 qTC_, uint256 tcAvailableToRedeem_);

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
     * @param liqThrld_ liquidation coverage threshold [PREC]
     * @param tcMintFee_ fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
     * @param tcRedeemFee_ fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
     * @param emaCalculationBlockSpan_ amount of blocks to wait between Pegged ema calculation
     */
    function __MocCore_init(
        IGovernor governor_,
        address stopper_,
        address tcTokenAddress_,
        address mocFeeFlowAddress_,
        uint256 ctarg_,
        uint256 protThrld_,
        uint256 liqThrld_,
        uint256 tcMintFee_,
        uint256 tcRedeemFee_,
        uint256 emaCalculationBlockSpan_
    ) internal onlyInitializing {
        __MocUpgradable_init(governor_, stopper_);
        __MocBaseBucket_init_unchained(
            tcTokenAddress_,
            mocFeeFlowAddress_,
            ctarg_,
            protThrld_,
            liqThrld_,
            tcMintFee_,
            tcRedeemFee_
        );
        __MocEma_init_unchained(emaCalculationBlockSpan_);
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
     * @return qACtotalNeeded amount of AC used to mint qTC
     */
    function _mintTCto(
        uint256 qTC_,
        uint256 qACmax_,
        address sender_,
        address recipient_
    ) internal notLiquidated returns (uint256 qACtotalNeeded) {
        // evaluates whether or not the system coverage is healthy enough to mint TC, reverts if it's not
        uint256 lckAC = _evalCoverage(protThrld);
        // calculates how many qAC are needed to mint TC and the qAC fee
        (uint256 qACNeededtoMint, uint256 qACfee) = _calcQACforMintTC(qTC_, lckAC);
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
     * @notice redeem Collateral Asset in exchange for Collateral Token
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param sender_ address who sends the Collateral Token
     * @param recipient_ address who receives the Collateral Asset
     * @return qACtoRedeem amount of AC sent to `recipient_`
     */
    function _redeemTCto(
        uint256 qTC_,
        uint256 qACmin_,
        address sender_,
        address recipient_
    ) internal notLiquidated returns (uint256 qACtoRedeem) {
        uint256 ctargema = calcCtargema();
        // evaluates whether or not the system coverage is healthy enough to redeem TC
        // given the target coverage adjusted by the moving average, reverts if it's not
        uint256 lckAC = _evalCoverage(ctargema);
        // calculate how many total qAC are redemeed and how many correspond for fee
        (uint256 qACtotalToRedeem, uint256 qACfee) = _calcQACforRedeemTC(qTC_, ctargema, lckAC);
        qACtoRedeem = qACtotalToRedeem - qACfee;
        if (qACtoRedeem < qACmin_) revert QacBelowMinimumRequired(qACmin_, qACtoRedeem);
        // sub qTC and qAC from the Bucket
        _withdrawTC(qTC_, qACtotalToRedeem);
        // burn qTC from the sender
        tcToken.burn(sender_, qTC_);
        // transfer qAC to the recipient
        acTransfer(recipient_, qACtoRedeem);
        // transfer qAC fees to Fee Flow
        acTransfer(mocFeeFlowAddress, qACfee);
        emit TCRedeemed(sender_, recipient_, qTC_, qACtoRedeem);
        return qACtoRedeem;
    }

    /**
     * @notice mint Pegged Token in exchange for Collateral Asset
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param sender_ address who sends the Collateral Asset, all unspent amount is returned to it
     * @param recipient_ address who receives the Pegged Token
     * @return qACtotalNeeded amount of AC used to mint qTP
     */
    function _mintTPto(
        uint8 i_,
        uint256 qTP_,
        uint256 qACmax_,
        address sender_,
        address recipient_
    ) internal notLiquidated returns (uint256 qACtotalNeeded) {
        uint256 ctargema = calcCtargema();
        // evaluates whether or not the system coverage is healthy enough to mint TP
        // given the target coverage adjusted by the moving average, reverts if it's not
        uint256 lckAC = _evalCoverage(ctargema);
        // calculate how many qAC are needed to mint TP and the qAC fee
        (uint256 qACNeededtoMint, uint256 qACfee) = _calcQACforMintTP(i_, qTP_, ctargema, lckAC);
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
     * @dev Note that the ema value, should consider `nextEmaCalculation`
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
        // TODO: this could be replaced by a "if exists modify it"
        if (peggedTokenIndex[tpTokenAddress_] != 0) revert PeggedTokenAlreadyAdded();
        uint8 newTPindex = uint8(tpToken.length);
        peggedTokenIndex[tpTokenAddress_] = newTPindex;

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
            newTPindex,
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
     * @param qTC_ amount of Collateral Token to mint [N]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @return qACNeededtoMint amount of Collateral Asset needed to mint [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function _calcQACforMintTC(uint256 qTC_, uint256 lckAC_)
        internal
        view
        returns (uint256 qACNeededtoMint, uint256 qACfee)
    {
        if (qTC_ == 0) revert InvalidValue();
        // calculate how many qAC are needed to mint TC
        // [N] = [N] * [PREC] / [PREC]
        qACNeededtoMint = (qTC_ * _getPTCac(lckAC_)) / PRECISION;
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = (qACNeededtoMint * tcMintFee) / PRECISION;

        return (qACNeededtoMint, qACfee);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to redeem an amount of Collateral Token
     * @param qTC_ amount of Collateral Token to redeem [N]
     * @param ctargema_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @return qACtotalToRedeem amount of Collateral Asset needed to redeem, including fees [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function _calcQACforRedeemTC(
        uint256 qTC_,
        uint256 ctargema_,
        uint256 lckAC_
    ) internal view returns (uint256 qACtotalToRedeem, uint256 qACfee) {
        if (qTC_ == 0) revert InvalidValue();
        uint256 tcAvailableToRedeem = _getTCAvailableToRedeem(ctargema_, lckAC_);

        // check if there are enough TC available to redeem
        if (tcAvailableToRedeem < qTC_) revert InsufficientTCtoRedeem(qTC_, tcAvailableToRedeem);

        // calculate how many qAC are redeemed
        // [N] = [N] * [PREC] / [PREC]
        qACtotalToRedeem = (qTC_ * _getPTCac(lckAC_)) / PRECISION;
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = (qACtotalToRedeem * tcRedeemFee) / PRECISION;
        return (qACtotalToRedeem, qACfee);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to mint an amount of Pegged Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint [N]
     * @param ctargema_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @return qACNeededtoMint amount of Collateral Asset needed to mint [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function _calcQACforMintTP(
        uint8 i_,
        uint256 qTP_,
        uint256 ctargema_,
        uint256 lckAC_
    ) internal view returns (uint256 qACNeededtoMint, uint256 qACfee) {
        if (qTP_ == 0) revert InvalidValue();

        uint256 pACtp = _getPACtp(i_);
        uint256 tpAvailableToMint = _getTPAvailableToMint(ctargema_, pACtp, lckAC_);
        // check if there are enough TP available to mint
        if (tpAvailableToMint < qTP_) revert InsufficientTPtoMint(qTP_, tpAvailableToMint);

        // calculate how many qAC are needed to mint TP
        // [N] = [N] * [PREC] / [PREC]
        qACNeededtoMint = (qTP_ * pACtp) / PRECISION;
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
