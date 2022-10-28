pragma solidity ^0.8.17;

import "../interfaces/IMocRC20.sol";
import "./MocEma.sol";
import "./MocInterestRate.sol";

/**
 * @title MocCore
 * @notice MocCore nucleates all the basic MoC functionality and tool set. It allows Collateral
 * asset aware contracts to implement the main mint/redeem operations.
 */
abstract contract MocCore is MocEma, MocInterestRate {
    // ------- Events -------
    event TCMinted(address indexed sender_, address indexed recipient_, uint256 qTC_, uint256 qAC_, uint256 qACfee_);
    event TCRedeemed(address indexed sender_, address indexed recipient_, uint256 qTC_, uint256 qAC_, uint256 qACfee_);
    event TPMinted(
        uint8 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_
    );
    event TPRedeemed(
        uint8 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qACinterest_
    );
    event PeggedTokenAdded(uint8 indexed i_, AddPeggedTokenParams addPeggedTokenParams_);
    // ------- Custom Errors -------
    error PeggedTokenAlreadyAdded();
    error InsufficientQacSent(uint256 qACsent_, uint256 qACNeeded_);
    error QacBelowMinimumRequired(uint256 qACmin_, uint256 qACtoRedeem_);
    error InsufficientTPtoMint(uint256 qTP_, uint256 tpAvailableToMint_);
    error InsufficientTCtoRedeem(uint256 qTC_, uint256 tcAvailableToRedeem_);
    error InsufficientTPtoRedeem(uint256 qTP_, uint256 tpAvailableToRedeem_);
    error QacNeededMustBeGreaterThanZero();

    // ------- Structs -------
    struct AddPeggedTokenParams {
        // Pegged Token contract address to add
        address tpTokenAddress;
        // priceProviderAddress Pegged Token price provider contract address
        address priceProviderAddress;
        // Pegged Token target coverage [PREC]
        uint256 tpCtarg;
        // Pegged Token reserve factor [PREC]
        uint256 tpR;
        // Pegged Token minimum amount of blocks until the settlement to charge interest for redeem [N]
        uint256 tpBmin;
        // fee pct sent to Fee Flow for mint [PREC]
        uint256 tpMintFee;
        // fee pct sent to Fee Flow for redeem [PREC]
        uint256 tpRedeemFee;
        // initial Pegged Token exponential moving average [PREC]
        uint256 tpEma;
        // Pegged Token smoothing factor [PREC]
        uint256 tpEmaSf;
        // Pegged Token initial interest rate
        uint256 tpTils;
        // Pegged Token minimum interest rate that can be charged
        uint256 tpTiMin;
        // Pegged Token maximum interest rate that can be charged
        uint256 tpTiMax;
        // abundance of Pegged Token where it is desired that the model stabilizes
        int256 tpAbeq;
        // Pegged Token minimum correction factor for interest rate
        int256 tpFacMin;
        // Pegged Token maximum correction factor for interest rate
        int256 tpFacMax;
    }

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @dev this function must be execute by the AC implementation at initialization
     * @param governorAddress_ The address that will define when a change contract is authorized
     * @param pauserAddress_ The address that is authorized to pause this contract
     * @param tcTokenAddress_ Collateral Token contract address
     * @param mocSettlementAddress_ MocSettlement contract address
     * @param mocFeeFlowAddress_ Moc Fee Flow contract address
     * @param mocInterestCollectorAddress_ mocInterestCollector address
     * @param protThrld_ protected state threshold [PREC]
     * @param liqThrld_ liquidation coverage threshold [PREC]
     * @param tcMintFee_ fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
     * @param tcRedeemFee_ fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
     * @param emaCalculationBlockSpan_ amount of blocks to wait between Pegged ema calculation
     */
    function __MocCore_init(
        address governorAddress_,
        address pauserAddress_,
        address tcTokenAddress_,
        address mocSettlementAddress_,
        address mocFeeFlowAddress_,
        address mocInterestCollectorAddress_,
        uint256 protThrld_,
        uint256 liqThrld_,
        uint256 tcMintFee_,
        uint256 tcRedeemFee_,
        uint256 emaCalculationBlockSpan_
    ) internal onlyInitializing {
        __MocUpgradable_init(governorAddress_, pauserAddress_);
        __MocBaseBucket_init_unchained(
            tcTokenAddress_,
            mocFeeFlowAddress_,
            mocInterestCollectorAddress_,
            protThrld_,
            liqThrld_,
            tcMintFee_,
            tcRedeemFee_
        );
        __MocEma_init_unchained(emaCalculationBlockSpan_);
        __MocInterestRate_init_unchained(mocSettlementAddress_);
    }

    // ------- Internal Functions -------

    /**
     * @notice transfer Collateral Asset
     * @dev this function must be overridden by the AC implementation
     *  and revert if transfer fails.
     * @param to_ address who receives the Collateral Asset
     * @param amount_ amount of Collateral Asset to transfer
     */
    function acTransfer(address to_, uint256 amount_) internal virtual;

    /**
     * @notice Collateral Asset balance
     * @dev this function must be overridden by the AC implementation
     * @param account address who's Collateral Asset balance we want to know of
     * @param balance `account`'s total amount of Collateral Asset
     */
    function acBalanceOf(address account) internal view virtual returns (uint256 balance);

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
        // if is 0 reverts because it is trying to redeem an amount below precision
        if (qACtotalNeeded == 0) revert QacNeededMustBeGreaterThanZero();
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
        emit TCMinted(sender_, recipient_, qTC_, qACtotalNeeded, qACfee);
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
        uint256 ctargemaCA = calcCtargemaCA();
        // evaluates whether or not the system coverage is healthy enough to redeem TC
        // given the target coverage adjusted by the moving average, reverts if it's not
        uint256 lckAC = _evalCoverage(ctargemaCA);
        // calculate how many total qAC are redemeed and how many correspond for fee
        (uint256 qACtotalToRedeem, uint256 qACfee) = _calcQACforRedeemTC(qTC_, ctargemaCA, lckAC);
        // if is 0 reverts because it is trying to redeem an amount below precision
        if (qACtotalToRedeem == 0) revert QacNeededMustBeGreaterThanZero();
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
        emit TCRedeemed(sender_, recipient_, qTC_, qACtoRedeem, qACfee);
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
        uint256 ctargemaCA = calcCtargemaCA();
        // evaluates whether or not the system coverage is healthy enough to mint TP
        // given the target coverage adjusted by the moving average, reverts if it's not
        uint256 lckAC = _evalCoverage(ctargemaCA);
        // calculate how many qAC are needed to mint TP and the qAC fee
        (uint256 qACNeededtoMint, uint256 qACfee) = _calcQACforMintTP(i_, qTP_, ctargemaCA, lckAC);
        qACtotalNeeded = qACNeededtoMint + qACfee;
        if (qACtotalNeeded > qACmax_) revert InsufficientQacSent(qACmax_, qACtotalNeeded);
        // if is 0 reverts because it is trying to mint an amount below precision
        if (qACtotalNeeded == 0) revert QacNeededMustBeGreaterThanZero();
        // add qTP and qAC to the Bucket
        _depositTP(i_, qTP_, qACNeededtoMint);
        // mint qTP to the recipient
        tpTokens[i_].mint(recipient_, qTP_);
        // calculate how many qAC should be returned to the sender
        uint256 qACchg = qACmax_ - qACtotalNeeded;
        // transfer the qAC change to the sender
        acTransfer(sender_, qACchg);
        // transfer qAC fees to Fee Flow
        acTransfer(mocFeeFlowAddress, qACfee);
        emit TPMinted(i_, sender_, recipient_, qTP_, qACtotalNeeded, qACfee);
        return qACtotalNeeded;
    }

    /**
     * @notice redeem Collateral Asset in exchange for Pegged Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param sender_ address who sends the Pegged Token
     * @param recipient_ address who receives the Collateral Asset
     * @return qACtoRedeem amount of AC sent to `recipient_`
     */
    function _redeemTPto(
        uint8 i_,
        uint256 qTP_,
        uint256 qACmin_,
        address sender_,
        address recipient_
    ) internal notLiquidated returns (uint256 qACtoRedeem) {
        // evaluates whether or not the system coverage is healthy enough to mint TC, reverts if it's not
        _evalCoverage(protThrld);
        // calculate how many qAC are needed to mint TP and the qAC fee
        // calculate how many total qAC are redeemed, how many correspond for fee and how many for interests
        (uint256 qACtotalToRedeem, uint256 qACfee, uint256 qACinterest) = _calcQACforRedeemTP(i_, qTP_);
        // if is 0 reverts because it is trying to redeem an amount below precision
        if (qACtotalToRedeem == 0) revert QacNeededMustBeGreaterThanZero();
        qACtoRedeem = qACtotalToRedeem - qACfee - qACinterest;
        if (qACtoRedeem < qACmin_) revert QacBelowMinimumRequired(qACmin_, qACtoRedeem);
        // sub qTP and qAC from the Bucket
        _withdrawTP(i_, qTP_, qACtotalToRedeem);
        // burn qTP from the sender
        tpTokens[i_].burn(sender_, qTP_);
        // transfer qAC to the recipient
        acTransfer(recipient_, qACtoRedeem);
        // transfer qAC fees to Fee Flow
        acTransfer(mocFeeFlowAddress, qACfee);
        // transfer qAC for interest
        acTransfer(mocInterestCollectorAddress, qACinterest);
        emit TPRedeemed(i_, sender_, recipient_, qTP_, qACtoRedeem, qACfee, qACinterest);
        return qACtoRedeem;
    }

    /**
     * @notice Allow redeem on liquidation state, user Peg balance gets burned and he receives
     * the equivalent AC given the liquidation frozen price.
     * @param i_ Pegged Token index
     * @param sender_ address owner of the TP to be redeemed
     * @param recipient_ address who receives the AC
     * @return qACRedeemed amount of AC sent to `recipient_`
     */
    function _liqRedeemTPTo(
        uint8 i_,
        address sender_,
        address recipient_
    ) internal returns (uint256 qACRedeemed) {
        if (!liquidated) revert OnlyWhenLiquidated();
        uint256 qTP = tpTokens[i_].balanceOf(sender_);
        if (qTP == 0) revert InsufficientTPtoRedeem(qTP, qTP);
        // [PREC]
        uint256 liqPACtp = tpLiqPrices[i_];
        // [PREC] = [N] * [PREC] / [PREC]
        qACRedeemed = (qTP * PRECISION) / liqPACtp;
        // burn qTP from the sender
        tpTokens[i_].burn(sender_, qTP);
        // Given rounding errors, the last redeemer might receive a little less
        if (acBalanceOf(address(this)) < qACRedeemed) qACRedeemed = acBalanceOf(address(this));
        // transfer qAC to the recipient, reverts if fail
        acTransfer(recipient_, qACRedeemed);
        emit TPRedeemed(i_, sender_, recipient_, qTP, qACRedeemed, 0, 0);
    }

    // ------- Public Functions -------

    /**
     * @notice Allow redeem on liquidation state, user Peg balance gets burned and he receives
     * the equivalent AC given the liquidation frozen price.
     * @param i_ Pegged Token index
     * @return qACRedeemed amount of AC sent to sender
     */
    function liqRedeemTP(uint8 i_) public returns (uint256 qACRedeemed) {
        return _liqRedeemTPTo(i_, msg.sender, msg.sender);
    }

    /**
     * @notice Allow redeem on liquidation state, user Peg balance gets burned and he receives
     * the equivalent AC given the liquidation frozen price.
     * @param i_ Pegged Token index
     * @param recipient_ address who receives the AC
     * @return qACRedeemed amount of AC sent to `recipient_`
     */
    function liqRedeemTPto(uint8 i_, address recipient_) public returns (uint256 qACRedeemed) {
        return _liqRedeemTPTo(i_, msg.sender, recipient_);
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
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @return qACtotalToRedeem amount of Collateral Asset needed to redeem, including fees [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function _calcQACforRedeemTC(
        uint256 qTC_,
        uint256 ctargemaCA_,
        uint256 lckAC_
    ) internal view returns (uint256 qACtotalToRedeem, uint256 qACfee) {
        if (qTC_ == 0) revert InvalidValue();
        uint256 tcAvailableToRedeem = _getTCAvailableToRedeem(ctargemaCA_, lckAC_);

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
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @return qACNeededtoMint amount of Collateral Asset needed to mint [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function _calcQACforMintTP(
        uint8 i_,
        uint256 qTP_,
        uint256 ctargemaCA_,
        uint256 lckAC_
    ) internal view returns (uint256 qACNeededtoMint, uint256 qACfee) {
        if (qTP_ == 0) revert InvalidValue();

        uint256 pACtp = _getPACtp(i_);
        uint256 ctargemaTP = _getCtargemaTP(i_, pACtp);
        uint256 tpAvailableToMint = _getTPAvailableToMint(ctargemaCA_, ctargemaTP, pACtp, lckAC_);
        // check if there are enough TP available to mint
        if (tpAvailableToMint < qTP_) revert InsufficientTPtoMint(qTP_, tpAvailableToMint);

        // calculate how many qAC are needed to mint TP
        // [N] = [N] * [PREC] / [PREC]
        qACNeededtoMint = (qTP_ * PRECISION) / pACtp;
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = (qACNeededtoMint * tpMintFee[i_]) / PRECISION;
        return (qACNeededtoMint, qACfee);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to redeem an amount of Pegged Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to redeem
     * @return qACtotalToRedeem amount of Collateral Asset needed to redeem, including fees [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     * @return qACinterest amount of Collateral Asset should be transfer to interest collector [N]
     */
    function _calcQACforRedeemTP(uint8 i_, uint256 qTP_)
        internal
        view
        returns (
            uint256 qACtotalToRedeem,
            uint256 qACfee,
            uint256 qACinterest
        )
    {
        if (qTP_ == 0) revert InvalidValue();

        uint256 pACtp = _getPACtp(i_);
        // get amount of TP in the bucket
        uint256 nTP = pegContainer[i_].nTP;
        // [N] = [N] - [N]
        uint256 tpAvailableToRedeem = nTP - pegContainer[i_].nTPXV;
        // check if there are enough TP available to redeem
        if (tpAvailableToRedeem < qTP_) revert InsufficientTPtoRedeem(qTP_, tpAvailableToRedeem);

        uint256 interestRate = _calcTPinterestRate(i_, qTP_, tpAvailableToRedeem, nTP);

        // calculate how many qAC are redeemed
        // [N] = [N] * [PREC] / [PREC]
        qACtotalToRedeem = (qTP_ * PRECISION) / pACtp;
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = (qACtotalToRedeem * tpRedeemFee[i_]) / PRECISION;
        // calculate how many qAC to transfer to interest collector
        // [N] = [N] * [PREC] / [PREC]
        qACinterest = (qACtotalToRedeem * interestRate) / PRECISION;
        return (qACtotalToRedeem, qACfee, qACinterest);
    }

    // ------- Only Authorized Changer Functions -------

    /**
     * @notice add a Pegged Token to the protocol
     * @dev Note that the ema value, should consider `nextEmaCalculation`
     * @param addPeggedTokenParams_ params of Pegged Token to add
     * @dev tpTokenAddress Pegged Token contract address to add
     *      priceProviderAddress Pegged Token price provider contract address
     *      tpCtarg Pegged Token target coverage [PREC]
     *      tpR Pegged Token reserve factor [PREC]
     *      tpBmin Pegged Token minimum amount of blocks until the settlement to charge interest for redeem [N]
     *      tpMintFee fee pct sent to Fee Flow for mint [PREC]
     *      tpRedeemFee fee pct sent to Fee Flow for redeem [PREC]
     *      tpEma initial Pegged Token exponential moving average [PREC]
     *      tpEmaSf Pegged Token smoothing factor [PREC]
     *      tpTils Pegged Token initial interest rate
     *      tpTiMin Pegged Token minimum interest rate that can be charged
     *      tpTiMax Pegged Token maximum interest rate that can be charged
     *      tpAbeq abundance of Pegged Token where it is desired that the model stabilizes
     *      tpFacMin Pegged Token minimum correction factor for interest rate
     *      tpFacMax Pegged Token maximum correction factor for interest rate
     *
     *  Requirements:
     *
     * - the caller must have governance authorization.
     * - tpTokenAddress must be a MocRC20, with mint, burn roles already settled
     *  for this contract
     */
    function addPeggedToken(AddPeggedTokenParams calldata addPeggedTokenParams_) external onlyAuthorizedChanger {
        IMocRC20 tpToken = IMocRC20(addPeggedTokenParams_.tpTokenAddress);
        // Verifies it has the right roles over this TP
        if (!tpToken.hasFullRoles(address(this))) revert InvalidAddress();

        IPriceProvider priceProvider = IPriceProvider(addPeggedTokenParams_.priceProviderAddress);
        // verifies it is a valid priceProvider
        (, bool has) = priceProvider.peek();
        if (!has) revert InvalidAddress();

        // TODO: this could be replaced by a "if exists modify it"
        if (peggedTokenIndex[address(tpToken)].exist) revert PeggedTokenAlreadyAdded();
        uint8 newTPindex = uint8(tpTokens.length);
        peggedTokenIndex[address(tpToken)] = PeggedTokenIndex({ index: newTPindex, exist: true });

        // set Pegged Token address
        tpTokens.push(tpToken);
        // set peg container item
        pegContainer.push(PegContainerItem({ nTP: 0, nTPXV: 0, priceProvider: priceProvider }));
        // set target coverage
        tpCtarg.push(addPeggedTokenParams_.tpCtarg);
        // set reserve factor
        tpR.push(addPeggedTokenParams_.tpR);
        // set minimum amount of blocks
        tpBmin.push(addPeggedTokenParams_.tpBmin);
        // set mint fee pct
        tpMintFee.push(addPeggedTokenParams_.tpMintFee);
        // set redeem fee pct
        tpRedeemFee.push(addPeggedTokenParams_.tpRedeemFee);
        // set EMA initial value and smoothing factor
        tpEma.push(EmaItem({ ema: addPeggedTokenParams_.tpEma, sf: addPeggedTokenParams_.tpEmaSf }));
        // set interest rate item
        tpInterestRate.push(
            InterestRateItem({
                tils: addPeggedTokenParams_.tpTils,
                tiMin: addPeggedTokenParams_.tpTiMin,
                tiMax: addPeggedTokenParams_.tpTiMax
            })
        );
        // set FAC item
        tpFAC.push(
            FACitem({
                abeq: addPeggedTokenParams_.tpAbeq,
                facMinSubOne: addPeggedTokenParams_.tpFacMin - int256(ONE),
                facMax: addPeggedTokenParams_.tpFacMax
            })
        );
        // emit the event
        emit PeggedTokenAdded(newTPindex, addPeggedTokenParams_);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
