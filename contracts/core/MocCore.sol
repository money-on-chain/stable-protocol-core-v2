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
    event TPSwapped(
        uint8 indexed iFrom_,
        uint8 iTo_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTPfrom_,
        uint256 qTPto_,
        uint256 qACfee_,
        uint256 qACinterest_
    );
    event TCandTPRedeemed(
        uint8 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qACinterest_
    );
    event PeggedTokenChange(uint8 indexed i_, PeggedTokenParams peggedTokenParams_);
    // ------- Custom Errors -------
    error PeggedTokenAlreadyAdded();
    error InsufficientQacSent(uint256 qACsent_, uint256 qACNeeded_);
    error QacBelowMinimumRequired(uint256 qACmin_, uint256 qACtoRedeem_);
    error InsufficientTPtoMint(uint256 qTP_, uint256 tpAvailableToMint_);
    error InsufficientTCtoRedeem(uint256 qTC_, uint256 tcAvailableToRedeem_);
    error InsufficientTPtoRedeem(uint256 qTP_, uint256 tpAvailableToRedeem_);
    error QacNeededMustBeGreaterThanZero();
    error QtpBelowMinimumRequired(uint256 qTPmin_, uint256 qTP_);
    error InsufficientQtpSent(uint256 qTPsent_, uint256 qTPNeeded_);
    // ------- Structs -------

    struct InitializeCoreParams {
        InitializeBaseBucketParams initializeBaseBucketParams;
        // The address that will define when a change contract is authorized
        address governorAddress;
        // The address that is authorized to pause this contract
        address pauserAddress;
        // amount of blocks to wait between Pegged ema calculation
        uint256 emaCalculationBlockSpan;
    }

    struct PeggedTokenParams {
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
     * @param initializeCoreParams_ contract initializer params
     *        governorAddress The address that will define when a change contract is authorized
     *        pauserAddress_ The address that is authorized to pause this contract
     *        tcTokenAddress Collateral Token contract address
     *        mocSettlementAddress MocSettlement contract address
     *        mocFeeFlowAddress Moc Fee Flow contract address
     *        mocInterestCollectorAddress mocInterestCollector address
     *        mocAppreciationBeneficiaryAddress Moc appreciation beneficiary address
     *        protThrld protected state threshold [PREC]
     *        liqThrld liquidation coverage threshold [PREC]
     *        tcMintFee fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
     *        tcRedeemFee fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
     *        successFee pct of the gain because Pegged Tokens devaluation that is transferred
     *          in Collateral Asset to Moc Fee Flow during the settlement [PREC]
     *        appreciationFactor pct of the gain because Pegged Tokens devaluation that is returned
     *          in Pegged Tokens to appreciation beneficiary during the settlement [PREC]]
     *        emaCalculationBlockSpan amount of blocks to wait between Pegged ema calculation
     */
    function __MocCore_init(InitializeCoreParams calldata initializeCoreParams_) internal onlyInitializing {
        __MocUpgradable_init(initializeCoreParams_.governorAddress, initializeCoreParams_.pauserAddress);
        __MocBaseBucket_init_unchained(initializeCoreParams_.initializeBaseBucketParams);
        __MocEma_init_unchained(initializeCoreParams_.emaCalculationBlockSpan);
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
     * @return balance `account`'s total amount of Collateral Asset
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
        (uint256 lckAC, uint256 nACgain) = _evalCoverage(protThrld);
        // calculates how many qAC are needed to mint TC and the qAC fee
        (uint256 qACNeededtoMint, uint256 qACfee) = _calcQACforMintTC(qTC_, lckAC, nACgain);
        qACtotalNeeded = qACNeededtoMint + qACfee;
        if (qACtotalNeeded > qACmax_) revert InsufficientQacSent(qACmax_, qACtotalNeeded);
        // if is 0 reverts because it is trying to redeem an amount below precision
        if (qACtotalNeeded == 0) revert QacNeededMustBeGreaterThanZero();
        // add qTC and qAC to the Bucket
        _depositTC(qTC_, qACNeededtoMint);
        // mint qTC to the recipient
        tcToken.mint(recipient_, qTC_);
        // transfer the qAC change to the sender
        acTransfer(sender_, qACmax_ - qACtotalNeeded);
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
        (uint256 lckAC, uint256 nACgain) = _evalCoverage(ctargemaCA);
        // evaluates if there are enough Collateral Token available to redeem, reverts if it`s not
        _evalTCavailableToRedeem(qTC_, ctargemaCA, lckAC, nACgain);
        // calculate how many total qAC are redeemed and how many correspond for fee
        (uint256 qACtotalToRedeem, uint256 qACfee) = _calcQACforRedeemTC(qTC_, lckAC, nACgain);
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
        uint256 pACtp = _getPACtp(i_);
        _updateTPtracking(i_, pACtp);
        uint256 ctargemaCA = calcCtargemaCA();
        // evaluates whether or not the system coverage is healthy enough to mint TP
        // given the target coverage adjusted by the moving average, reverts if it's not
        (uint256 lckAC, uint256 nACgain) = _evalCoverage(ctargemaCA);
        // evaluates if there are enough TP available to mint, reverts if it's not
        _evalTPavailableToMint(i_, qTP_, pACtp, ctargemaCA, lckAC, nACgain);
        // calculate how many qAC are needed to mint TP and the qAC fee
        (uint256 qACNeededtoMint, uint256 qACfee) = _calcQACforMintTP(i_, qTP_, pACtp);
        qACtotalNeeded = qACNeededtoMint + qACfee;
        if (qACtotalNeeded > qACmax_) revert InsufficientQacSent(qACmax_, qACtotalNeeded);
        // if is 0 reverts because it is trying to mint an amount below precision
        if (qACtotalNeeded == 0) revert QacNeededMustBeGreaterThanZero();
        // add qTP and qAC to the Bucket
        _depositTP(i_, qTP_, qACNeededtoMint);
        // mint qTP to the recipient
        tpTokens[i_].mint(recipient_, qTP_);
        // transfer the qAC change to the sender
        acTransfer(sender_, qACmax_ - qACtotalNeeded);
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
        uint256 pACtp = _getPACtp(i_);
        _updateTPtracking(i_, pACtp);
        // evaluates whether or not the system coverage is healthy enough to mint TC, reverts if it's not
        _evalCoverage(protThrld);
        // calculate how many total qAC are redeemed, how many correspond for fee and how many for interests
        (uint256 qACtotalToRedeem, uint256 qACfee, uint256 qACinterest) = _calcQACforRedeemTP(i_, qTP_, pACtp);
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
     * @notice redeem Collateral Asset in exchange for Collateral Token and Pegged Token
     *  This operation is done without check coverage
     *  Redeem Collateral Token and Pegged Token in equal proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param i_ Pegged Token index
     * @param qTC_ amount of Collateral Token to redeem
     * @param qTP_ maximum amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param sender_ address who sends Collateral Token and Pegged Token
     * @param recipient_ address who receives the Collateral Asset
     * @return qACtoRedeem amount of AC sent to `recipient_`
     * @return qTPtoRedeem amount of Pegged Token redeemed
     */
    function _redeemTCandTPto(
        uint8 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACmin_,
        address sender_,
        address recipient_
    ) internal notLiquidated returns (uint256 qACtoRedeem, uint256) {
        uint256 pACtp = _getPACtp(i_);
        _updateTPtracking(i_, pACtp);
        (uint256 lckAC, uint256 nACgain) = _getLckACandACgain();
        // qTPtoRedeem = (qTC * pACtp * pTCac) / (cglb - 1)
        // pTCac = totalACavailable - lckAC ; cglb = totalACavailable / lckAC
        // So, we can simplify
        // [N] = ([N] * [N] * [PREC] / [PREC]) / [N]
        uint256 qTPtoRedeem = _mulPrec(qTC_ * lckAC, pACtp) / nTCcb;

        if (qTPtoRedeem > qTP_) revert InsufficientQtpSent(qTP_, qTPtoRedeem);
        (uint256 qACtotalToRedeem, uint256 qACfee, uint256 qACinterest) = _calcQACforRedeemTCandTP(
            i_,
            qTC_,
            qTPtoRedeem,
            pACtp,
            _getPTCac(lckAC, nACgain)
        );
        qACtoRedeem = qACtotalToRedeem - qACfee - qACinterest;
        if (qACtoRedeem < qACmin_) revert QacBelowMinimumRequired(qACmin_, qACtoRedeem);

        // sub qTC and qAC from the Bucket
        _withdrawTC(qTC_, qACtotalToRedeem);
        // sub qTP from the Bucket
        _withdrawTP(i_, qTPtoRedeem, 0);
        // burn qTC from the sender
        {
            // TODO: refactor this when issue #91 is applied
            uint256 qTC = qTC_;
            tcToken.burn(sender_, qTC);
        }
        // burn qTP from the sender
        tpTokens[i_].burn(sender_, qTPtoRedeem);
        // transfer qAC to the recipient
        acTransfer(recipient_, qACtoRedeem);
        // transfer qAC fees to Fee Flow
        acTransfer(mocFeeFlowAddress, qACfee);
        // transfer qAC for interest
        acTransfer(mocInterestCollectorAddress, qACinterest);
        // inside a block to avoid stack too deep error
        {
            uint8 i = i_;
            uint256 qTC = qTC_;
            uint256 qACtoRedeem_ = qACtoRedeem;
            emit TCandTPRedeemed(i, sender_, recipient_, qTC, qTPtoRedeem, qACtoRedeem_, qACfee, qACinterest);
        }
        return (qACtoRedeem, qTPtoRedeem);
    }

    /**
     * @notice swap Pegged Token to another one
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees and interests
     * @param sender_ address who sends the Pegged Token
     * @param recipient_ address who receives the target Pegged Token
     * @return qACtotalNeeded amount of AC used to pay fee and interest
     */
    function _swapTPforTPto(
        uint8 iFrom_,
        uint8 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qACmax_,
        address sender_,
        address recipient_
    ) internal notLiquidated returns (uint256 qACtotalNeeded) {
        if (iFrom_ == iTo_) revert InvalidValue();
        uint256 pACtpFrom = _getPACtp(iFrom_);
        uint256 pACtpTo = _getPACtp(iTo_);
        _updateTPtracking(iFrom_, pACtpFrom);
        _updateTPtracking(iTo_, pACtpTo);
        // calculate how many total qAC are redeemed, how many correspond for fee and how many for interests
        (uint256 qACtotalToRedeem, , uint256 qACinterest) = _calcQACforRedeemTP(iFrom_, qTP_, pACtpFrom);
        // calculate how many qTP can mint with the given qAC
        // [N] = [N] * [PREC] / [PREC]
        uint256 qTPtoMint = (qTP_ * pACtpTo) / pACtpFrom;
        if (qTPtoMint < qTPmin_ || qTPtoMint == 0) revert QtpBelowMinimumRequired(qTPmin_, qTPtoMint);

        // if ctargemaTPto > ctargemaTPfrom we need to check coverage
        if (tpCtarg[iTo_] > tpCtarg[iFrom_]) {
            uint256 ctargemaCA = calcCtargemaCA();
            // evaluates whether or not the system coverage is healthy enough to mint TP
            // given the target coverage adjusted by the moving average, reverts if it's not
            (uint256 lckAC, uint256 nACgain) = _evalCoverage(ctargemaCA);
            // evaluates if there are enough TP available to mint, reverts if it's not
            _evalTPavailableToMint(iTo_, qTPtoMint, pACtpTo, ctargemaCA, lckAC, nACgain);
        }

        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        uint256 qACfee = _mulPrec(qACtotalToRedeem, swapTPforTPFee);
        qACtotalNeeded = qACfee + qACinterest;
        if (qACtotalNeeded > qACmax_) revert InsufficientQacSent(qACmax_, qACtotalNeeded);

        // sub qTP from the Bucket
        _withdrawTP(iFrom_, qTP_, 0);
        // add qTP to the Bucket
        _depositTP(iTo_, qTPtoMint, 0);
        // burn qTP from the sender
        tpTokens[iFrom_].burn(sender_, qTP_);
        // mint qTP to the recipient
        tpTokens[iTo_].mint(recipient_, qTPtoMint);
        // transfer the qAC change to the sender
        acTransfer(sender_, qACmax_ - qACtotalNeeded);
        // transfer qAC fees to Fee Flow
        acTransfer(mocFeeFlowAddress, qACfee);
        // transfer qAC for interest
        acTransfer(mocInterestCollectorAddress, qACinterest);
        // inside a block to avoid stack too deep error
        {
            uint8 iFrom = iFrom_;
            uint8 iTo = iTo_;
            uint256 qTP = qTP_;
            emit TPSwapped(iFrom, iTo, sender_, recipient_, qTP, qTPtoMint, qACfee, qACinterest);
        }
        return qACtotalNeeded;
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
        qACRedeemed = _divPrec(qTP, liqPACtp);
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
    function liqRedeemTP(uint8 i_) external returns (uint256 qACRedeemed) {
        return _liqRedeemTPTo(i_, msg.sender, msg.sender);
    }

    /**
     * @notice Allow redeem on liquidation state, user Peg balance gets burned and he receives
     * the equivalent AC given the liquidation frozen price.
     * @param i_ Pegged Token index
     * @param recipient_ address who receives the AC
     * @return qACRedeemed amount of AC sent to `recipient_`
     */
    function liqRedeemTPto(uint8 i_, address recipient_) external returns (uint256 qACRedeemed) {
        return _liqRedeemTPTo(i_, msg.sender, recipient_);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to mint an amount of Collateral Token
     * @param qTC_ amount of Collateral Token to mint [N]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return qACNeededtoMint amount of Collateral Asset needed to mint [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function _calcQACforMintTC(
        uint256 qTC_,
        uint256 lckAC_,
        uint256 nACgain_
    ) internal view returns (uint256 qACNeededtoMint, uint256 qACfee) {
        if (qTC_ == 0) revert InvalidValue();
        // calculate how many qAC are needed to mint TC
        // [N] = [N] * [PREC] / [PREC]
        qACNeededtoMint = _mulPrec(qTC_, _getPTCac(lckAC_, nACgain_));
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = _mulPrec(qACNeededtoMint, tcMintFee);

        return (qACNeededtoMint, qACfee);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to redeem an amount of Collateral Token
     * @param qTC_ amount of Collateral Token to redeem [N]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return qACtotalToRedeem amount of Collateral Asset needed to redeem, including fees [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function _calcQACforRedeemTC(
        uint256 qTC_,
        uint256 lckAC_,
        uint256 nACgain_
    ) internal view returns (uint256 qACtotalToRedeem, uint256 qACfee) {
        if (qTC_ == 0) revert InvalidValue();
        // calculate how many qAC are redeemed
        // [N] = [N] * [PREC] / [PREC]
        qACtotalToRedeem = _mulPrec(qTC_, _getPTCac(lckAC_, nACgain_));
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = _mulPrec(qACtotalToRedeem, tcRedeemFee);
        return (qACtotalToRedeem, qACfee);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to mint an amount of Pegged Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint [N]
     * @param pACtp_ Pegged Token price [PREC]
     * @return qACNeededtoMint amount of Collateral Asset needed to mint [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function _calcQACforMintTP(
        uint8 i_,
        uint256 qTP_,
        uint256 pACtp_
    ) internal view returns (uint256 qACNeededtoMint, uint256 qACfee) {
        if (qTP_ == 0) revert InvalidValue();
        // calculate how many qAC are needed to mint TP
        // [N] = [N] * [PREC] / [PREC]
        qACNeededtoMint = _divPrec(qTP_, pACtp_);
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = _mulPrec(qACNeededtoMint, tpMintFee[i_]);
        return (qACNeededtoMint, qACfee);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to redeem an amount of Pegged Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to redeem
     * @param pACtp_ Pegged Token price [PREC]
     * @return qACtotalToRedeem amount of Collateral Asset needed to redeem, including fees [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     * @return qACinterest amount of Collateral Asset should be transfer to interest collector [N]
     */
    function _calcQACforRedeemTP(
        uint8 i_,
        uint256 qTP_,
        uint256 pACtp_
    )
        internal
        view
        returns (
            uint256 qACtotalToRedeem,
            uint256 qACfee,
            uint256 qACinterest
        )
    {
        if (qTP_ == 0) revert InvalidValue();
        // get amount of TP in the bucket
        uint256 nTP = pegContainer[i_].nTP;
        // [N] = [N] - [N]
        uint256 tpAvailableToRedeem = nTP - pegContainer[i_].nTPXV;
        (uint256 tpGain, ) = _getPnLTP(i_, tpAvailableToRedeem, pACtp_);
        tpAvailableToRedeem += tpGain;
        // check if there are enough TP available to redeem
        if (tpAvailableToRedeem < qTP_) revert InsufficientTPtoRedeem(qTP_, tpAvailableToRedeem);
        uint256 interestRate = _calcTPinterestRate(i_, qTP_, tpAvailableToRedeem, nTP + tpGain);
        // calculate how many qAC are redeemed
        // [N] = [N] * [PREC] / [PREC]
        qACtotalToRedeem = _divPrec(qTP_, pACtp_);
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = _mulPrec(qACtotalToRedeem, tpRedeemFee[i_]);
        // calculate how many qAC to transfer to interest collector
        // [N] = [N] * [PREC] / [PREC]
        qACinterest = _mulPrec(qACtotalToRedeem, interestRate);
        return (qACtotalToRedeem, qACfee, qACinterest);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to redeem an amount of Collateral Token
     * and Pegged Token in one operation
     * @param i_ Pegged Token index
     * @param qTC_ amount of Collateral Token to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param pACtp_ Pegged Token price [PREC]
     * @param pTCac_ Collateral Token price [PREC]
     * @return qACtotalToRedeem amount of Collateral Asset needed to redeem, including fees [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     * @return qACinterest amount of Collateral Asset should be transfer to interest collector [N]
     */
    function _calcQACforRedeemTCandTP(
        uint8 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 pACtp_,
        uint256 pTCac_
    )
        internal
        view
        returns (
            uint256 qACtotalToRedeem,
            uint256 qACfee,
            uint256 qACinterest
        )
    {
        if (qTC_ == 0) revert InvalidValue();
        // calculate how many total qAC are redeemed, how many correspond for fee and how many for interests
        (qACtotalToRedeem, , qACinterest) = _calcQACforRedeemTP(i_, qTP_, pACtp_);
        // calculate how many qAC are redeemed because TC
        // [N] = [N] * [PREC] / [N]
        qACtotalToRedeem += _mulPrec(qTC_, pTCac_);
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = _mulPrec(qACtotalToRedeem, redeemTCandTPFee);
        return (qACtotalToRedeem, qACfee, qACinterest);
    }

    /**
     * @notice evaluates if there are enough Collateral Token availabie to redeem, reverts if it`s not
     * @param qTC_ amount of Collateral Token to redeem [N]
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @param nACtoMint_ amount of Collateral Asset that will be distributed at
     *         settlement because Pegged Token devaluation [N]
     */
    function _evalTCavailableToRedeem(
        uint256 qTC_,
        uint256 ctargemaCA_,
        uint256 lckAC_,
        uint256 nACtoMint_
    ) internal view {
        uint256 tcAvailableToRedeem = _getTCAvailableToRedeem(ctargemaCA_, lckAC_, nACtoMint_);
        // check if there are enough TC available to redeem
        if (tcAvailableToRedeem < qTC_) revert InsufficientTCtoRedeem(qTC_, tcAvailableToRedeem);
    }

    /**
     * @notice evaluates if there are enough Pegged Token availabie to mint, reverts if it`s not
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint [N]
     * @param pACtp_ Pegged Token price [PREC]
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     */
    function _evalTPavailableToMint(
        uint8 i_,
        uint256 qTP_,
        uint256 pACtp_,
        uint256 ctargemaCA_,
        uint256 lckAC_,
        uint256 nACgain_
    ) internal view {
        uint256 ctargemaTP = _getCtargemaTP(i_, pACtp_);
        uint256 tpAvailableToMint = _getTPAvailableToMint(ctargemaCA_, ctargemaTP, pACtp_, lckAC_, nACgain_);
        // check if there are enough TP available to mint
        if (tpAvailableToMint < qTP_) revert InsufficientTPtoMint(qTP_, tpAvailableToMint);
    }

    /**
     * @notice distribute appreciation factor to beneficiary and success fee to Moc Fee Flow
     */
    function _distributeSuccessFee() internal {
        uint256 mocGain;
        uint256 pegAmount = pegContainer.length;
        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            uint256 pACtp = _getPACtp(i);
            _updateTPtracking(i, pACtp);
            int256 iou = tpiou[i];
            if (iou > 0) {
                // [N] = (([PREC] * [PREC] / [PREC]) * [N]) / [PREC]
                uint256 tpToMint = _mulPrec(_mulPrec(appreciationFactor, pACtp), uint256(iou));
                // [N] = [N] + [N]
                mocGain += uint256(iou);
                // reset TP profit
                tpiou[i] = 0;
                // add qTP to the Bucket
                _depositTP(i, tpToMint, 0);
                // mint TP to appreciation beneficiary, is not necessary to check coverage
                tpTokens[i].mint(mocAppreciationBeneficiaryAddress, tpToMint);
            }
        }
        if (mocGain != 0) {
            // [N] = [N] * [PREC] / [PREC]
            mocGain = _mulPrec(mocGain, successFee);
            // sub qAC from the Bucket
            nACcb -= mocGain;
            // transfer the qAC to Moc Fee Flow
            acTransfer(mocFeeFlowAddress, mocGain);
        }
    }

    // ------- Only Settlement Functions -------

    /**
     * @notice this function is executed during settlement.
     *  stores amount of locked AC by Pegged Tokens at this moment and distribute success fee
     */
    function execSettlement() external onlySettlement {
        _distributeSuccessFee();
    }

    // ------- Only Authorized Changer Functions -------

    /**
     * @notice add a Pegged Token to the protocol
     * @dev Note that the ema value, should consider `nextEmaCalculation`
     * @param peggedTokenParams_ params of Pegged Token to add
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
    function addPeggedToken(PeggedTokenParams calldata peggedTokenParams_) external onlyAuthorizedChanger {
        IMocRC20 tpToken = IMocRC20(peggedTokenParams_.tpTokenAddress);
        // Verifies it has the right roles over this TP
        if (!tpToken.hasFullRoles(address(this))) revert InvalidAddress();

        IPriceProvider priceProvider = IPriceProvider(peggedTokenParams_.priceProviderAddress);
        if (peggedTokenIndex[address(tpToken)].exists) revert PeggedTokenAlreadyAdded();
        uint8 newTPindex = uint8(tpTokens.length);
        peggedTokenIndex[address(tpToken)] = PeggedTokenIndex({ index: newTPindex, exists: true });

        // set Pegged Token address
        tpTokens.push(tpToken);
        // set peg container item
        pegContainer.push(PegContainerItem({ nTP: 0, nTPXV: 0, priceProvider: priceProvider }));
        // set target coverage
        tpCtarg.push(peggedTokenParams_.tpCtarg);
        // set reserve factor
        tpR.push(peggedTokenParams_.tpR);
        // set minimum amount of blocks
        tpBmin.push(peggedTokenParams_.tpBmin);
        // set mint fee pct
        tpMintFee.push(peggedTokenParams_.tpMintFee);
        // set redeem fee pct
        tpRedeemFee.push(peggedTokenParams_.tpRedeemFee);
        // set EMA initial value and smoothing factor
        tpEma.push(EmaItem({ ema: peggedTokenParams_.tpEma, sf: peggedTokenParams_.tpEmaSf }));
        // set interest rate item
        tpInterestRate.push(
            InterestRateItem({
                tils: peggedTokenParams_.tpTils,
                tiMin: peggedTokenParams_.tpTiMin,
                tiMax: peggedTokenParams_.tpTiMax
            })
        );
        // set FAC item
        tpFAC.push(
            FACitem({
                abeq: peggedTokenParams_.tpAbeq,
                facMinSubOne: peggedTokenParams_.tpFacMin - int256(ONE),
                facMax: peggedTokenParams_.tpFacMax
            })
        );
        tpiou.push();
        // reverts if price provider is invalid
        pACtpLstop.push(_getPACtp(newTPindex));
        // emit the event
        emit PeggedTokenChange(newTPindex, peggedTokenParams_);
    }

    /**
     * @notice modifies a Pegged Token of the protocol
     * @dev Note that the ema value, should consider `nextEmaCalculation`
     * @param peggedTokenParams_ params of Pegged Token to add
     * @dev tpTokenAddress Pegged Token contract address to identify the token to edit
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
     * - the tpTokenAddress must exists
     */
    function editPeggedToken(PeggedTokenParams calldata peggedTokenParams_) external onlyAuthorizedChanger {
        PeggedTokenIndex memory ptIndex = peggedTokenIndex[peggedTokenParams_.tpTokenAddress];
        if (!ptIndex.exists) revert InvalidAddress();
        uint8 i = ptIndex.index;
        // if being edited, verifies it is a valid priceProvider
        if (peggedTokenParams_.priceProviderAddress != address(pegContainer[i].priceProvider)) {
            IPriceProvider priceProvider = IPriceProvider(peggedTokenParams_.priceProviderAddress);
            (, bool has) = priceProvider.peek();
            if (!has) revert InvalidAddress();
            pegContainer[i].priceProvider = priceProvider;
        }
        // set target coverage
        tpCtarg[i] = peggedTokenParams_.tpCtarg;
        // set reserve factor
        tpR[i] = peggedTokenParams_.tpR;
        // set minimum amount of blocks
        tpBmin[i] = peggedTokenParams_.tpBmin;
        // set mint fee pct
        tpMintFee[i] = peggedTokenParams_.tpMintFee;
        // set redeem fee pct
        tpRedeemFee[i] = peggedTokenParams_.tpRedeemFee;
        // set EMA initial value and smoothing factor
        tpEma[i].sf = peggedTokenParams_.tpEmaSf;
        // set interest rate item
        tpInterestRate[i].tiMin = peggedTokenParams_.tpTiMin;
        tpInterestRate[i].tiMax = peggedTokenParams_.tpTiMax;
        // set FAC item
        tpFAC[i] = FACitem({
            abeq: peggedTokenParams_.tpAbeq,
            facMinSubOne: peggedTokenParams_.tpFacMin - int256(ONE),
            facMax: peggedTokenParams_.tpFacMax
        });
        // emit the event
        emit PeggedTokenChange(i, peggedTokenParams_);
    }

    // ------- Getters Functions -------

    /**
     * @notice get Collateral Token price
     * @return pTCac [PREC]
     */
    function getPTCac() external view returns (uint256 pTCac) {
        (uint256 lckAC, uint256 nACgain) = _getLckACandACgain();
        return _getPTCac(lckAC, nACgain);
    }

    /**
     * @notice get bucket global coverage
     * @return cglob [PREC]
     */
    function getCglb() external view returns (uint256 cglob) {
        (uint256 lckAC, uint256 nACgain) = _getLckACandACgain();
        return _getCglb(lckAC, nACgain);
    }

    /**
     * @notice get amount of Collateral Token available to redeem
     * @dev because it is a view function we are not calculating the new ema,
     *  since we are using the last ema calculation, this may differ a little from the real amount
     *  of TC available to redeem. Consider it an approximation.
     * @return tcAvailableToRedeem [N]
     */
    function getTCAvailableToRedeem() external view returns (uint256 tcAvailableToRedeem) {
        (uint256 lckAC, uint256 nACgain) = _getLckACandACgain();
        return _getTCAvailableToRedeem(_getCtargemaCA(), lckAC, nACgain);
    }

    /**
     * @notice get amount of Pegged Token available to mint
     * @dev because it is a view function we are not calculating the new ema,
     *  since we are using the last ema calculation, this may differ a little from the real amount
     *  of TP available to mint. Consider it an approximation.
     * @param i_ Pegged Token index
     * @return tpAvailableToMint [N]
     */
    function getTPAvailableToMint(uint8 i_) external view returns (uint256 tpAvailableToMint) {
        uint256 pACtp = _getPACtp(i_);
        (uint256 lckAC, uint256 nACgain) = _getLckACandACgain();
        return _getTPAvailableToMint(_getCtargemaCA(), _getCtargemaTP(i_, pACtp), pACtp, lckAC, nACgain);
    }

    /**
     * @notice get total Collateral Asset available
     * @return totalACavailable [N]
     */
    function getTotalACavailable() external view returns (uint256 totalACavailable) {
        (, uint256 nACgain) = _getLckACandACgain();
        return _getTotalACavailable(nACgain);
    }

    /**
     * @notice get Collateral Token leverage
     * @return leverageTC [PREC]
     */
    function getLeverageTC() external view returns (uint256 leverageTC) {
        (uint256 lckAC, uint256 nACgain) = _getLckACandACgain();
        return _getLeverageTC(lckAC, nACgain);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
