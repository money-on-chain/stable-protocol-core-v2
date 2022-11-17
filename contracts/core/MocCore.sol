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
    event TPSwappedForTP(
        uint8 indexed iFrom_,
        uint8 iTo_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTPfrom_,
        uint256 qTPto_,
        uint256 qACfee_,
        uint256 qACinterest_
    );
    event TPSwappedForTC(
        uint8 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qTC_,
        uint256 qACfee_,
        uint256 qACinterest_
    );
    event TCSwappedForTP(
        uint8 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACfee_
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
    event TCandTPMinted(
        uint8 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_
    );
    event PeggedTokenChange(uint8 indexed i_, PeggedTokenParams peggedTokenParams_);
    event SuccessFeeDistributed(uint256 mocGain_, uint256[] tpGain_);
    // ------- Custom Errors -------
    error PeggedTokenAlreadyAdded();
    error InsufficientQacSent(uint256 qACsent_, uint256 qACNeeded_);
    error QacBelowMinimumRequired(uint256 qACmin_, uint256 qACtoRedeem_);
    error InsufficientTPtoMint(uint256 qTP_, uint256 tpAvailableToMint_);
    error InsufficientTCtoRedeem(uint256 qTC_, uint256 tcAvailableToRedeem_);
    error InsufficientTPtoRedeem(uint256 qTP_, uint256 tpAvailableToRedeem_);
    error QacNeededMustBeGreaterThanZero();
    error QtpBelowMinimumRequired(uint256 qTPmin_, uint256 qTP_);
    error QtcBelowMinimumRequired(uint256 qTCmin_, uint256 qTC_);
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
        // additional fee pct applied on mint [PREC]
        uint256 tpMintFee;
        // additional fee pct applied on redeem [PREC]
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
     *        feeRetainer pct retain on fees to be re-injected as Collateral, while paying fees with AC [PREC]
     *        tcMintFee additional fee pct applied on mint Collateral Tokens operations [PREC]
     *        tcRedeemFee additional fee pct applied on redeem Collateral Tokens operations [PREC]
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
    ) internal notLiquidated notPaused returns (uint256 qACtotalNeeded) {
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
        // transfers any AC change to the sender, and distributes fees
        _distOpResults(sender_, qACmax_ - qACtotalNeeded, qACfee, 0);
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
    ) internal notLiquidated notPaused returns (uint256 qACtoRedeem) {
        uint256 ctargemaCA = calcCtargemaCA();
        // evaluates whether or not the system coverage is healthy enough to redeem TC
        // given the target coverage adjusted by the moving average, reverts if it's not
        (uint256 lckAC, uint256 nACgain) = _evalCoverage(ctargemaCA);
        // evaluates if there are enough Collateral Tokens available to redeem, reverts if there are not
        _evalTCAvailableToRedeem(qTC_, ctargemaCA, lckAC, nACgain);
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
        // transfers qAC to the recipient, and distributes fees
        _distOpResults(recipient_, qACtoRedeem, qACfee, 0);
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
    ) internal notLiquidated notPaused returns (uint256 qACtotalNeeded) {
        uint256 pACtp = getPACtp(i_);
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
        // transfers any AC change to the sender, and distributes fees
        _distOpResults(sender_, qACmax_ - qACtotalNeeded, qACfee, 0);
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
    ) internal notLiquidated notPaused returns (uint256 qACtoRedeem) {
        uint256 pACtp = getPACtp(i_);
        _updateTPtracking(i_, pACtp);
        // evaluates whether or not the system coverage is healthy enough to redeem TP, reverts if it's not
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
        // transfers qAC to the recipient, and distributes fees and interests
        _distOpResults(recipient_, qACtoRedeem, qACfee, qACinterest);
        emit TPRedeemed(i_, sender_, recipient_, qTP_, qACtoRedeem, qACfee, qACinterest);
        return qACtoRedeem;
    }

    /**
     * @notice mint Collateral Token and Pegged Token in exchange for Collateral Asset
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint
     * @param qACmax_ maximum amount of Collateral Asset that can be spent
     * @param sender_ address who sends Collateral Asset
     * @param recipient_ address who receives the Collateral Token and Pegged Token
     * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
     * @return qTCtoMint amount of Collateral Token minted
     */
    function _mintTCandTPto(
        uint8 i_,
        uint256 qTP_,
        uint256 qACmax_,
        address sender_,
        address recipient_
    ) internal notLiquidated notPaused returns (uint256 qACtotalNeeded, uint256 qTCtoMint) {
        uint256 qACNeededtoMint;
        uint256 qACfee;
        uint256 pACtp = getPACtp(i_);
        _updateTPtracking(i_, pACtp);
        (qTCtoMint, qACNeededtoMint, qACfee) = _calcQACforMintTCandTP(qTP_, pACtp);
        qACtotalNeeded = qACNeededtoMint + qACfee;
        if (qACtotalNeeded > qACmax_) revert InsufficientQacSent(qACmax_, qACtotalNeeded);
        // if is 0 reverts because it is trying to mint an amount below precision
        if (qACtotalNeeded == 0) revert QacNeededMustBeGreaterThanZero();
        // add qTC and qAC to the Bucket
        _depositTC(qTCtoMint, qACNeededtoMint);
        // add qTP to the Bucket
        _depositTP(i_, qTP_, 0);
        // mint qTC to the recipient
        tcToken.mint(recipient_, qTCtoMint);
        // mint qTP from the recipient
        tpTokens[i_].mint(recipient_, qTP_);
        // transfers qAC to the sender, and distributes fees
        _distOpResults(sender_, qACmax_ - qACtotalNeeded, qACfee, 0);
        emit TCandTPMinted(i_, sender_, recipient_, qTCtoMint, qTP_, qACtotalNeeded, qACfee);
        return (qACtotalNeeded, qTCtoMint);
    }

    /**
     * @notice redeem Collateral Asset in exchange for Collateral Token and Pegged Token
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that its price
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
    ) internal notLiquidated notPaused returns (uint256 qACtoRedeem, uint256 qTPtoRedeem) {
        uint256 pACtp = getPACtp(i_);
        _updateTPtracking(i_, pACtp);
        (uint256 lckAC, uint256 nACgain) = _getLckACandACgain();
        // calculate how many TP are needed to redeem TC and not change coverage
        // qTPtoRedeem = (qTC * pACtp * pTCac) / (cglb - 1)
        // pTCac = (totalACavailable - lckAC) / nTCcb
        // cglb = totalACavailable / lckAC => cglb - 1 = (totalACavailable - lckAC) / lckAC
        // pTCac = (qTC * pACtp * (totalACavailable - lckAC) / nTCcb) / ((totalACavailable - lckAC) / lckAC)
        // So, we can simplify (totalACavailable - lckAC)
        // pTCac = (qTC * pACtp * lckAC) / nTCcb
        // [N] = ([N] * [N] * [PREC] / [N]) /  [PREC]
        qTPtoRedeem = ((qTC_ * lckAC * pACtp) / nTCcb) / PRECISION;

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

        // transfers qAC to the recipient, and distributes fees and interests
        _distOpResults(recipient_, qACtoRedeem, qACfee, qACinterest);
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
     *  This operation is done without checking coverage unless the target coverage for
     *  received Pegged Token is greater than the Pegged Token sent
     * @param iFrom_ owned Pegged Token index
     * @param iTo_ target Pegged Token index
     * @param qTP_ amount of owned Pegged Token to swap
     * @param qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees and interests
     * @param sender_ address who sends the Pegged Token
     * @param recipient_ address who receives the target Pegged Token
     * @return qACtotalNeeded amount of AC used to pay fee and interest
     * @return qTPtoMint amount of Pegged Token minted
     */
    function _swapTPforTPto(
        uint8 iFrom_,
        uint8 iTo_,
        uint256 qTP_,
        uint256 qTPmin_,
        uint256 qACmax_,
        address sender_,
        address recipient_
    ) internal notLiquidated notPaused returns (uint256 qACtotalNeeded, uint256 qTPtoMint) {
        if (iFrom_ == iTo_) revert InvalidValue();
        uint256 pACtpFrom = getPACtp(iFrom_);
        uint256 pACtpTo = getPACtp(iTo_);
        _updateTPtracking(iFrom_, pACtpFrom);
        _updateTPtracking(iTo_, pACtpTo);
        // calculate how many total qAC are redeemed, how many correspond for fee and how many for interests
        (uint256 qACtotalToRedeem, , uint256 qACinterest) = _calcQACforRedeemTP(iFrom_, qTP_, pACtpFrom);
        // calculate how many qTP can mint with the given qAC
        // [N] = [N] * [PREC] / [PREC]
        qTPtoMint = (qTP_ * pACtpTo) / pACtpFrom;
        if (qTPtoMint < qTPmin_ || qTPtoMint == 0) revert QtpBelowMinimumRequired(qTPmin_, qTPtoMint);

        // if ctargemaTPto > ctargemaTPfrom we need to check coverage
        if (_getCtargemaTP(iTo_, pACtpTo) > _getCtargemaTP(iFrom_, pACtpFrom)) {
            uint256 ctargemaCA = calcCtargemaCA();
            // evaluates whether or not the system coverage is healthy enough to mint TP
            // given the target coverage adjusted by the moving average, reverts if it's not
            (uint256 lckAC, uint256 nACgain) = _evalCoverage(ctargemaCA);
            // evaluates if there are enough TP available to mint, reverts if it's not
            _evalTPavailableToMint(iTo_, qTPtoMint, pACtpTo, ctargemaCA, lckAC, nACgain);
        }

        // calculates qAC to be charged as fee
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
        // transfer any qAC change to the sender, and distribute fees and interests
        _distOpResults(sender_, qACmax_ - qACtotalNeeded, qACfee, qACinterest);
        // inside a block to avoid stack too deep error
        {
            uint8 iFrom = iFrom_;
            uint8 iTo = iTo_;
            uint256 qTP = qTP_;
            emit TPSwappedForTP(iFrom, iTo, sender_, recipient_, qTP, qTPtoMint, qACfee, qACinterest);
        }
        return (qACtotalNeeded, qTPtoMint);
    }

    /**
     * @notice swap Pegged Token to Collateral Token
     * @param i_ Pegged Token index
     * @param qTP_ amount Pegged Token to swap
     * @param qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees and interests
     * @param sender_ address who sends the Pegged Token
     * @param recipient_ address who receives Collateral Token
     * @return qACtotalNeeded amount of AC used to pay fee and interest
     * @return qTCtoMint amount of Collateral Token minted
     */
    function _swapTPforTCto(
        uint8 i_,
        uint256 qTP_,
        uint256 qTCmin_,
        uint256 qACmax_,
        address sender_,
        address recipient_
    ) internal notLiquidated notPaused returns (uint256 qACtotalNeeded, uint256 qTCtoMint) {
        uint256 pACtp = getPACtp(i_);
        _updateTPtracking(i_, pACtp);
        // evaluates whether or not the system coverage is healthy enough to mint TC, reverts if it's not
        (uint256 lckAC, uint256 nACgain) = _evalCoverage(protThrld);
        // calculate how many total qAC are redeemed, how many correspond for fee and how many for interests
        (uint256 qACtotalToRedeem, , uint256 qACinterest) = _calcQACforRedeemTP(i_, qTP_, pACtp);
        // calculate how many qTC can mint with the given qAC
        // qTCtoMint = qTP / pTCac / pACtp
        // [N] = [N] * [N] * [PREC] / ([N] - [N]) * [PREC]
        qTCtoMint = _divPrec(qTP_ * nTCcb, (_getTotalACavailable(nACgain) - lckAC) * pACtp);
        if (qTCtoMint < qTCmin_ || qTCtoMint == 0) revert QtcBelowMinimumRequired(qTCmin_, qTCtoMint);

        // calculate qAC to be charged as fee
        // [N] = [N] * [PREC] / [PREC]
        uint256 qACfee = _mulPrec(qACtotalToRedeem, swapTPforTCFee);
        qACtotalNeeded = qACfee + qACinterest;
        if (qACtotalNeeded > qACmax_) revert InsufficientQacSent(qACmax_, qACtotalNeeded);

        // sub qTP from the Bucket
        _withdrawTP(i_, qTP_, 0);
        // add qTC to the Bucket
        _depositTC(qTCtoMint, 0);
        // burn qTP from the sender
        tpTokens[i_].burn(sender_, qTP_);
        // mint qTC to the recipient
        tcToken.mint(recipient_, qTCtoMint);
        // transfer any qAC change to the sender, and distribute fees and interests
        _distOpResults(sender_, qACmax_ - qACtotalNeeded, qACfee, qACinterest);
        // inside a block to avoid stack too deep error
        {
            uint8 i = i_;
            uint256 qTP = qTP_;
            emit TPSwappedForTC(i, sender_, recipient_, qTP, qTCtoMint, qACfee, qACinterest);
        }
        return (qACtotalNeeded, qTCtoMint);
    }

    /**
     * @notice swap Collateral Token to Pegged Token
     * @param i_ Pegged Token index
     * @param qTC_ amount of Collateral Token to swap
     * @param qTPmin_ minimum amount of Pegged Token Token that `recipient_` expects to receive
     * @param qACmax_ maximum amount of Collateral Asset that can be spent in fees
     * @param sender_ address who sends the Collateral Token
     * @param recipient_ address who receives the Pegged Token
     * @return qACtotalNeeded amount of AC used to pay fee
     * @return qTPtoMint amount of Pegged Token minted
     */
    function _swapTCforTPto(
        uint8 i_,
        uint256 qTC_,
        uint256 qTPmin_,
        uint256 qACmax_,
        address sender_,
        address recipient_
    ) internal notLiquidated notPaused returns (uint256 qACtotalNeeded, uint256 qTPtoMint) {
        uint256 pACtp = getPACtp(i_);
        _updateTPtracking(i_, pACtp);
        uint256 ctargemaCA = calcCtargemaCA();
        // evaluates whether or not the system coverage is healthy enough to redeem TC
        // given the target coverage adjusted by the moving average, reverts if it's not
        (uint256 lckAC, uint256 nACgain) = _evalCoverage(ctargemaCA);
        // evaluates if there are enough Collateral Tokens available to redeem, reverts if there are not
        _evalTCAvailableToRedeem(qTC_, ctargemaCA, lckAC, nACgain);
        // calculate how many total qAC are redeemed and how many correspond for fee
        (uint256 qACtotalToRedeem, ) = _calcQACforRedeemTC(qTC_, lckAC, nACgain);
        // calculate how many qTP can mint with the given qAC
        // qTPtoMint = qTC * pTCac * pACtp
        // [N] = ([N] * ([N] - [N]) * [PREC] / [N]) / [PREC]
        qTPtoMint = ((qTC_ * (_getTotalACavailable(nACgain) - lckAC) * pACtp) / nTCcb) / PRECISION;
        // evaluates if there are enough TP available to mint, reverts if it's not
        _evalTPavailableToMint(i_, qTPtoMint, pACtp, ctargemaCA, lckAC, nACgain);
        if (qTPtoMint < qTPmin_ || qTPtoMint == 0) revert QtcBelowMinimumRequired(qTPmin_, qTPtoMint);

        // calculates qAC to be charged as fee
        // [N] = [N] * [PREC] / [PREC]
        qACtotalNeeded = _mulPrec(qACtotalToRedeem, swapTPforTCFee);
        if (qACtotalNeeded > qACmax_) revert InsufficientQacSent(qACmax_, qACtotalNeeded);

        // sub qTC from the Bucket
        _withdrawTC(qTC_, 0);
        // add qTP to the Bucket
        _depositTP(i_, qTPtoMint, 0);
        // burn qTC from the sender
        tcToken.burn(sender_, qTC_);
        // mint qTP to the recipient
        tpTokens[i_].mint(recipient_, qTPtoMint);
        // transfer any qAC change to the sender, and distribute fees
        _distOpResults(sender_, qACmax_ - qACtotalNeeded, qACtotalNeeded, 0);
        // inside a block to avoid stack too deep error
        {
            uint8 i = i_;
            uint256 qTC = qTC_;
            emit TCSwappedForTP(i, sender_, recipient_, qTC, qTPtoMint, qACtotalNeeded);
        }
        return (qACtotalNeeded, qTPtoMint);
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
    ) internal notPaused returns (uint256 qACRedeemed) {
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

    /**
     * @notice Distributes Operation results to the different recipients
     * @param operatorsAddress_ operator's address to receive `operatorsQAC_`
     * @param operatorsQAC_ amount of AC to transfer operator [N]
     * @param qACfee_ amount of AC to be distributed as fees [N]
     * @param qACinterest_ amount of AC to be distributed as interests [N]
     */
    function _distOpResults(
        address operatorsAddress_,
        uint256 operatorsQAC_,
        uint256 qACfee_,
        uint256 qACinterest_
    ) internal {
        // [N] = [PREC] * [N] / [PREC]
        uint256 qACfeeRetained = _mulPrec(feeRetainer, qACfee_);
        // Increase collateral in the retain amount
        // TODO: review after issue #99 is completed
        nACcb += qACfeeRetained;
        // transfer qAC leftover fees to Fee Flow
        acTransfer(mocFeeFlowAddress, qACfee_ - qACfeeRetained);
        // transfer qAC for interest
        acTransfer(mocInterestCollectorAddress, qACinterest_);
        // transfer qAC to operator
        acTransfer(operatorsAddress_, operatorsQAC_);
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
     * @return qACfee amount of Collateral Asset in concept of fees [N]
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
        // calculates qAC to be charged as fee
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
     * @return qACfee amount of Collateral Asset in concept of fees [N]
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
        // calculates qAC to be charged as fee
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
     * @return qACfee amount of Collateral Asset in concept of fees [N]
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
        // calculates qAC to be charged as fee
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
     * @return qACfee amount of Collateral Asset in concept of fees [N]
     * @return qACinterest amount of Collateral Asset should be transfer to interest collector [N]
     */
    function _calcQACforRedeemTP(
        uint8 i_,
        uint256 qTP_,
        uint256 pACtp_
    ) internal view returns (uint256 qACtotalToRedeem, uint256 qACfee, uint256 qACinterest) {
        if (qTP_ == 0) revert InvalidValue();
        // get amount of TP in the bucket
        uint256 nTP = pegContainer[i_].nTP;
        // [N] = [N] - [N]
        uint256 tpAvailableToRedeem = nTP - pegContainer[i_].nTPXV;
        (uint256 tpGain, ) = _getPnLTP(i_, tpAvailableToRedeem, pACtp_);
        tpAvailableToRedeem += tpGain;
        // check if there are enough TP available to redeem
        if (tpAvailableToRedeem < qTP_) revert InsufficientTPtoRedeem(qTP_, tpAvailableToRedeem);
        uint256 interestRate = _calcTPinterestRate(i_, qTP_, tpAvailableToRedeem, nTP, tpGain);
        // calculate how many qAC are redeemed
        // [N] = [N] * [PREC] / [PREC]
        qACtotalToRedeem = _divPrec(qTP_, pACtp_);
        // calculates qAC to be charged as fee
        // [N] = [N] * [PREC] / [PREC]
        qACfee = _mulPrec(qACtotalToRedeem, tpRedeemFee[i_]);
        // calculate how many qAC to transfer to interest collector
        // [N] = [N] * [PREC] / [PREC]
        qACinterest = _mulPrec(qACtotalToRedeem, interestRate);
        return (qACtotalToRedeem, qACfee, qACinterest);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to mint an amount of Collateral Token
     * and Pegged Token in one operation
     * @param qTP_ amount of Pegged Token to mint
     * @param pACtp_ Pegged Token price [PREC]
     * @return qTCtoMint amount of Collateral Token to mint [N]
     * @return qACNeededtoMint amount of Collateral Asset needed to mint [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function _calcQACforMintTCandTP(
        uint256 qTP_,
        uint256 pACtp_
    ) internal view returns (uint256 qTCtoMint, uint256 qACNeededtoMint, uint256 qACfee) {
        (uint256 lckAC, uint256 nACgain) = _getLckACandACgain();
        uint256 pTCac = _getPTCac(lckAC, nACgain);
        // calculate how many TC are needed to mint TP and total qAC used for mint both
        // [N] = [N] * ([PREC] - [PREC]) / [PREC]
        qACNeededtoMint = (qTP_ * (_getCtargemaCA() - ONE)) / pACtp_;
        // [N] = [N] *  [PREC] / [PREC]
        qTCtoMint = _divPrec(qACNeededtoMint, pTCac);
        // [N] = [N] + [N] *  [PREC] / [PREC]
        qACNeededtoMint = qACNeededtoMint + _divPrec(qTP_, pACtp_);
        // [N] = [N] * [PREC] / [PREC]
        qACfee = _mulPrec(qACNeededtoMint, mintTCandTPFee);
        return (qTCtoMint, qACNeededtoMint, qACfee);
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
     * @return qACfee amount of Collateral Asset in concept of fees [N]
     * @return qACinterest amount of Collateral Asset should be transfer to interest collector [N]
     */
    function _calcQACforRedeemTCandTP(
        uint8 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 pACtp_,
        uint256 pTCac_
    ) internal view returns (uint256 qACtotalToRedeem, uint256 qACfee, uint256 qACinterest) {
        // calculate how many total qAC are redeemed, how many correspond for fee and how many for interests
        (qACtotalToRedeem, , qACinterest) = _calcQACforRedeemTP(i_, qTP_, pACtp_);
        // calculate how many qAC are redeemed because TC
        // [N] = [N] * [PREC] / [PREC]
        qACtotalToRedeem += _mulPrec(qTC_, pTCac_);
        // calculates qAC to be charged as fee
        // [N] = [N] * [PREC] / [PREC]
        qACfee = _mulPrec(qACtotalToRedeem, redeemTCandTPFee);
        return (qACtotalToRedeem, qACfee, qACinterest);
    }

    /**
     * @notice evaluates if there is enough Collateral Token available to redeem, reverts if there's not
     * @param qTC_ amount of Collateral Token to redeem [N]
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @param nACgain_ amount of Collateral Asset that will be distributed at
     *         settlement because Pegged Token devaluation [N]
     */
    function _evalTCAvailableToRedeem(
        uint256 qTC_,
        uint256 ctargemaCA_,
        uint256 lckAC_,
        uint256 nACgain_
    ) internal view {
        uint256 tcAvailableToRedeem = _getTCAvailableToRedeem(ctargemaCA_, lckAC_, nACgain_);
        // check if there are enough TC available to redeem
        if (tcAvailableToRedeem < qTC_) revert InsufficientTCtoRedeem(qTC_, tcAvailableToRedeem);
    }

    /**
     * @notice evaluates if there are enough Pegged Token available to mint, reverts if it`s not
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
        uint256[] memory tpToMint = new uint256[](pegAmount);
        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            uint256 pACtp = getPACtp(i);
            _updateTPtracking(i, pACtp);
            int256 iou = tpiou[i];
            if (iou > 0) {
                // [N] = (([PREC] * [PREC] / [PREC]) * [N]) / [PREC]
                tpToMint[i] = _mulPrec(_mulPrec(appreciationFactor, pACtp), uint256(iou));
                // [N] = [N] + [N]
                mocGain += uint256(iou);
                // reset TP profit
                tpiou[i] = 0;
                // add qTP to the Bucket
                _depositTP(i, tpToMint[i], 0);
                // mint TP to appreciation beneficiary, is not necessary to check coverage
                tpTokens[i].mint(mocAppreciationBeneficiaryAddress, tpToMint[i]);
            }
        }
        if (mocGain != 0) {
            // [N] = [N] * [PREC] / [PREC]
            mocGain = _mulPrec(mocGain, successFee);
            // sub qAC from the Bucket
            nACcb -= mocGain;
            // transfer the mocGain AC to Moc Fee Flow
            acTransfer(mocFeeFlowAddress, mocGain);
        }
        emit SuccessFeeDistributed(mocGain, tpToMint);
    }

    // ------- Only Settlement Functions -------

    /**
     * @notice this function is executed during settlement.
     *  stores amount of locked AC by Pegged Tokens at this moment and distribute success fee
     */
    function execSettlement() external onlySettlement notPaused {
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
     *      tpMintFee additional fee pct applied on mint [PREC]
     *      tpRedeemFee additional fee pct applied on redeem [PREC]
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
        pACtpLstop.push(getPACtp(newTPindex));
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
     *      tpMintFee additional fee pct applied on mint [PREC]
     *      tpRedeemFee additional fee pct applied on redeem [PREC]
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
        uint256 pACtp = getPACtp(i_);
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
     * @notice returns how many Collateral Asset are needed to redeem `qTP_` amount of Pegged Token `i_`
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to redeem
     * @return qACtotalToRedeem amount of Collateral Asset needed to redeem, including fees [N]
     * @return qACfee amount of Collateral Asset in concept of fees [N]
     * @return qACinterest amount of Collateral Asset in concept of interests [N]
     */
    function getQACforRedeemTP(
        uint8 i_,
        uint256 qTP_
    ) external view returns (uint256 qACtotalToRedeem, uint256 qACfee, uint256 qACinterest) {
        return _calcQACforRedeemTP(i_, qTP_, getPACtp(i_));
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
