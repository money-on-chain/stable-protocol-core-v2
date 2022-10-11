pragma solidity ^0.8.16;

import "../interfaces/IMocRC20.sol";
import "./MocEma.sol";
import "./MocInterestRate.sol";
import "hardhat/console.sol";

/**
 * @title MocCore
 * @notice MocCore nucleats all the basic MoC functionality and toolset. It allows Collateral
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

    struct InitializeCoreParams {
        InitializeBaseBucketParams initializeBaseBucketParams;
        // The address that will define when a change contract is authorized
        address governorAddress;
        // The address that is authorized to pause this contract
        address stopperAddress;
        // amount of blocks to wait between Pegged ema calculation
        uint256 emaCalculationBlockSpan;
    }
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
     * @param initializeCoreParams_ contract initializer params
     * @dev   governorAddress The address that will define when a change contract is authorized
     *        stopperAddress The address that is authorized to pause this contract
     *        tcTokenAddress Collateral Token contract address
     *        mocSettlementAddress MocSettlement contract address
     *        mocFeeFlowAddress Moc Fee Flow contract address
     *        mocInterestCollectorAddress mocInterestCollector address
     *        mocturboAddress mocTurbo address
     *        protThrld protected state threshold [PREC]
     *        liqThrld liquidation coverage threshold [PREC]
     *        tcMintFee fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
     *        tcRedeemFee fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
     *        sf proportion of the devaluation that is transferred to MoC Fee Flow during the settlement [PREC]
     *        fa proportion of the devaluation that is returned to Turbo during the settlement [PREC]
     *        emaCalculationBlockSpan amount of blocks to wait between Pegged ema calculation
     */
    function __MocCore_init(InitializeCoreParams calldata initializeCoreParams_) internal onlyInitializing {
        __MocUpgradable_init(initializeCoreParams_.governorAddress, initializeCoreParams_.stopperAddress);
        __MocBaseBucket_init_unchained(initializeCoreParams_.initializeBaseBucketParams);
        __MocEma_init_unchained(initializeCoreParams_.emaCalculationBlockSpan);
    }

    // ------- Internal Functions -------

    /**
     * @notice transfer Collateral Asset
     * @dev this function must be overriden by the AC implementation
     *  and revert if transfer fails.
     * @param to_ address who receives the Collateral Asset
     * @param amount_ amount of Collateral Asset to transfer
     */
    function acTransfer(address to_, uint256 amount_) internal virtual;

    /**
     * @notice Collateral Asset balance
     * @dev this function must be overriden by the AC implementation
     * @param account address whos Collateral Asset balance we want to know of
     * @param balance `account`'s total amount of Colateral Asset
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
        address recipient_,
        bool checkCoverage_
    ) internal notLiquidated returns (uint256 qACtotalNeeded) {
        uint256 lckAC = _getLckAC();
        uint256 nACtoMint = _getACtoMint(lckAC);
        // evaluates whether or not the system coverage is healthy enough to mint TC, reverts if it's not
        if (checkCoverage_) _evalCoverage(protThrld, lckAC, nACtoMint);
        // calculates how many qAC are needed to mint TC and the qAC fee
        (uint256 qACNeededtoMint, uint256 qACfee) = _calcQACforMintTC(qTC_, lckAC, nACtoMint);
        qACtotalNeeded = qACNeededtoMint + qACfee;
        if (qACtotalNeeded > qACmax_) revert InsufficientQacSent(qACmax_, qACtotalNeeded);
        // if is 0 reverts because it is triyng to redeem an amount below precision
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
        address recipient_,
        bool checkCoverage_
    ) internal notLiquidated returns (uint256 qACtoRedeem) {
        uint256 ctargemaCA = calcCtargemaCA();
        uint256 lckAC = _getLckAC();
        uint256 nACtoMint = _getACtoMint(lckAC);
        // evaluates whether or not the system coverage is healthy enough to redeem TC
        // given the target coverage adjusted by the moving average, reverts if it's not
        if (checkCoverage_) _evalCoverage(ctargemaCA, lckAC, nACtoMint);
        // calculate how many total qAC are redemeed and how many correspond for fee
        (uint256 qACtotalToRedeem, uint256 qACfee) = _calcQACforRedeemTC(
            qTC_,
            ctargemaCA,
            lckAC,
            nACtoMint,
            checkCoverage_
        );
        // if is 0 reverts because it is triyng to redeem an amount below precision
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
        address recipient_,
        bool checkCoverage_
    ) internal notLiquidated returns (uint256 qACtotalNeeded) {
        uint256 ctargemaCA = calcCtargemaCA();
        uint256 lckAC = _getLckAC();
        uint256 nACtoMint = _getACtoMint(lckAC);
        // evaluates whether or not the system coverage is healthy enough to mint TP
        // given the target coverage adjusted by the moving average, reverts if it's not
        if (checkCoverage_) _evalCoverage(ctargemaCA, lckAC, nACtoMint);
        // calculate how many qAC are needed to mint TP and the qAC fee
        (uint256 qACNeededtoMint, uint256 qACfee) = _calcQACforMintTP(i_, qTP_, ctargemaCA, lckAC, nACtoMint);
        qACtotalNeeded = qACNeededtoMint + qACfee;
        if (qACtotalNeeded > qACmax_) revert InsufficientQacSent(qACmax_, qACtotalNeeded);
        // if is 0 reverts because it is triyng to mint an amount below precision
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
        address recipient_,
        bool checkCoverage_
    ) internal notLiquidated returns (uint256 qACtoRedeem) {
        uint256 lckAC = _getLckAC();
        // evaluates whether or not the system coverage is healthy enough to redeem TP, reverts if it's not
        if (checkCoverage_) _evalCoverage(protThrld, lckAC, _getACtoMint(lckAC));
        // calculate how many qAC are needed to mint TP and the qAC fee
        // calculate how many total qAC are redemeed, how many correspond for fee and how many for interests
        (uint256 qACtotalToRedeem, uint256 qACfee, uint256 qACinterest) = _calcQACforRedeemTP(i_, qTP_);
        // if is 0 reverts because it is triyng to redeem an amount below precision
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

    function _redeemTCandTPto(
        uint8 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACmin_,
        address sender_,
        address recipient_
    ) internal notLiquidated {
        uint256 lckAC = _getLckAC();
        uint256 nACtoMint = _getACtoMint(lckAC);
        uint256 pTCac = _getPTCac(lckAC, nACtoMint);
        uint256 pACtp = _getPACtp(i_);
        uint256 cglbMinusOne = _getCglb(lckAC, nACtoMint) - ONE;
        // calculate how many qAC are redeemed
        // [PREC] = [N] * [PREC] / ([PREC] - [PREC])
        uint256 qTPtoRedeem = ((qTC_ * pTCac * pACtp) / cglbMinusOne) / PRECISION;
        if (qTPtoRedeem > qTP_) {
            qTPtoRedeem = qTP_;
            // [N] = [N] * ([PREC] - [PREC]) / [PREC]
            qTC_ = (qTPtoRedeem * cglbMinusOne) / pACtp;
            console.log("aca");
        }
        console.log(cglbMinusOne);
        console.log(qTPtoRedeem);
        uint256 qACtotalRedeemed = _redeemTCto(qTC_, qACmin_, sender_, recipient_, false);
        qACtotalRedeemed += _redeemTPto(i_, qTPtoRedeem, qACmin_, sender_, recipient_, false);
        if (qACtotalRedeemed < qACmin_) revert QacBelowMinimumRequired(qACmin_, qACtotalRedeemed);
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
     * @param nACtoMint_ amount of Collateral Asset that will be distributed at
     *         settlement because Pegged Token devaluation [N]
     * @return qACNeededtoMint amount of Collateral Asset needed to mint [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function _calcQACforMintTC(
        uint256 qTC_,
        uint256 lckAC_,
        uint256 nACtoMint_
    ) internal view returns (uint256 qACNeededtoMint, uint256 qACfee) {
        if (qTC_ == 0) revert InvalidValue();
        // calculate how many qAC are needed to mint TC
        // [N] = [N] * [PREC] / [PREC]
        qACNeededtoMint = _mulPrec(qTC_, _getPTCac(lckAC_, nACtoMint_));
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = _mulPrec(qACNeededtoMint, tcMintFee);

        return (qACNeededtoMint, qACfee);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to redeem an amount of Collateral Token
     * @param qTC_ amount of Collateral Token to redeem [N]
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @param nACtoMint_ amount of Collateral Asset that will be distributed at
     *         settlement because Pegged Token devaluation [N]
     * @return qACtotalToRedeem amount of Collateral Asset needed to redeem, including fees [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function _calcQACforRedeemTC(
        uint256 qTC_,
        uint256 ctargemaCA_,
        uint256 lckAC_,
        uint256 nACtoMint_,
        bool checkCoverage_
    ) internal view returns (uint256 qACtotalToRedeem, uint256 qACfee) {
        if (qTC_ == 0) revert InvalidValue();
        if (checkCoverage_) {
            uint256 tcAvailableToRedeem = _getTCAvailableToRedeem(ctargemaCA_, lckAC_, nACtoMint_);

            // check if there are enough TC available to redeem
            if (tcAvailableToRedeem < qTC_) revert InsufficientTCtoRedeem(qTC_, tcAvailableToRedeem);
        }

        // calculate how many qAC are redeemed
        // [N] = [N] * [PREC] / [PREC]
        qACtotalToRedeem = _mulPrec(qTC_, _getPTCac(lckAC_, nACtoMint_));
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = _mulPrec(qACtotalToRedeem, tcRedeemFee);
        return (qACtotalToRedeem, qACfee);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to mint an amount of Pegged Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to mint [N]
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @param nACtoMint_ amount of Collateral Asset that will be distributed at
     *         settlement because Pegged Token devaluation [N]
     * @return qACNeededtoMint amount of Collateral Asset needed to mint [N]
     * @return qACfee amount of Collateral Asset should be transfer to Fee Flow [N]
     */
    function _calcQACforMintTP(
        uint8 i_,
        uint256 qTP_,
        uint256 ctargemaCA_,
        uint256 lckAC_,
        uint256 nACtoMint_
    ) internal view returns (uint256 qACNeededtoMint, uint256 qACfee) {
        if (qTP_ == 0) revert InvalidValue();

        uint256 pACtp = _getPACtp(i_);
        uint256 ctargemaTP = _getCtargemaTP(i_, pACtp);
        uint256 tpAvailableToMint = _getTPAvailableToMint(ctargemaCA_, ctargemaTP, pACtp, lckAC_, nACtoMint_);
        // check if there are enough TP available to mint
        if (tpAvailableToMint < qTP_) revert InsufficientTPtoMint(qTP_, tpAvailableToMint);

        // calculate how many qAC are needed to mint TP
        // [N] = [N] * [PREC] / [PREC]
        qACNeededtoMint = _divPrec(qTP_, pACtp);
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = _mulPrec(qACNeededtoMint, tpMintFee[i_]);
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
        qACtotalToRedeem = _divPrec(qTP_, pACtp);
        // calculate qAC fee to transfer to Fee Flow
        // [N] = [N] * [PREC] / [PREC]
        qACfee = _mulPrec(qACtotalToRedeem, tpRedeemFee[i_]);
        // calculate how many qAC to transfer to interest collector
        // [N] = [N] * [PREC] / [PREC]
        qACinterest = _mulPrec(qACtotalToRedeem, interestRate);
        return (qACtotalToRedeem, qACfee, qACinterest);
    }

    /**
     * @notice distribute appreciation factor to Turbo and success fee to Moc Fee Flow
     */
    function _distributeSuccessFee() internal {
        uint256 acDuetoFlow;
        uint256 pegAmount = pegContainer.length;
        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            uint256 pACtp = _getPACtp(i);
            uint256 acLstset = nACLstset[i];
            // [N] = ([N] * [PREC] / [PREC])
            uint256 acSpot = _divPrec(pegContainer[i].nTP, pACtp);
            if (acLstset > acSpot) {
                // [N] = [N] - [N]
                uint256 eqTPac = acLstset - acSpot;
                acDuetoFlow += eqTPac;
                // [N] = [N] * [PREC] / [PREC]
                uint256 tpDueToDif = _mulPrec(eqTPac, fa);
                // [N] = [N] * [PREC] / [PREC]
                uint256 tpToMint = _mulPrec(tpDueToDif, pACtp);
                // add qTP to the Bucket
                pegContainer[i].nTP += tpToMint;
                // mint TP to Turbo, is not neccesary to check coverage
                tpTokens[i].mint(mocTurboAddress, tpToMint);
            }
        }
        // [N] = [N] * [PREC] / [PREC]
        acDuetoFlow = _mulPrec(acDuetoFlow, sf);
        // sub qAC from the Bucket
        nACcb -= acDuetoFlow;
        // transfer the qAC to Moc Fee Flow
        acTransfer(mocFeeFlowAddress, acDuetoFlow);
    }

    // ------- Only Settlement Functions -------

    /**
     * @notice this function is executed during settlement.
     *  stores amount of locked AC by Pegged Tokens at this moment and distribute success fee
     */
    function execSettlement() external onlySettlement {
        _distributeSuccessFee();
        _updateBucketLstset();
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
     * - the caller must have governace authorization.
     * - tpTokenAddress must be a MocRC20, with mint, burn roles already settled
     *  for this contract
     */
    function addPeggedToken(AddPeggedTokenParams calldata addPeggedTokenParams_) external onlyAuthorizedChanger {
        if (addPeggedTokenParams_.tpCtarg < ONE) revert InvalidValue();
        if (addPeggedTokenParams_.tpMintFee > PRECISION) revert InvalidValue();
        if (addPeggedTokenParams_.tpRedeemFee > PRECISION) revert InvalidValue();
        if (addPeggedTokenParams_.tpEmaSf >= ONE) revert InvalidValue();
        if (addPeggedTokenParams_.tpTils > PRECISION) revert InvalidValue();
        if (addPeggedTokenParams_.tpTiMin > PRECISION) revert InvalidValue();
        if (addPeggedTokenParams_.tpTiMax > PRECISION) revert InvalidValue();
        if (addPeggedTokenParams_.tpAbeq > int256(ONE)) revert InvalidValue();
        if (addPeggedTokenParams_.tpFacMin > int256(ONE)) revert InvalidValue();
        if (addPeggedTokenParams_.tpFacMax < int256(ONE)) revert InvalidValue();

        MocRC20 tpToken = MocRC20(addPeggedTokenParams_.tpTokenAddress);
        // Verifies it has the right roles over this TP
        if (
            !tpToken.hasRole(tpToken.MINTER_ROLE(), address(this)) ||
            !tpToken.hasRole(tpToken.BURNER_ROLE(), address(this)) ||
            !tpToken.hasRole(tpToken.DEFAULT_ADMIN_ROLE(), address(this))
        ) {
            revert InvalidAddress();
        }
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
        nACLstset.push();
        // emit the event
        emit PeggedTokenAdded(newTPindex, addPeggedTokenParams_);
    }

    // ------- Getters Functions -------

    /**
     * @notice get Collateral Token price
     * @return pTCac [PREC]
     */
    function getPTCac() external view returns (uint256 pTCac) {
        uint256 lckAC = _getLckAC();
        uint256 nACtoMint = _getACtoMint(lckAC);
        return _getPTCac(lckAC, nACtoMint);
    }

    /**
     * @notice get bucket global coverage
     * @return cglob [PREC]
     */
    function getCglb() external view returns (uint256 cglob) {
        uint256 lckAC = _getLckAC();
        uint256 nACtoMint = _getACtoMint(lckAC);
        return _getCglb(lckAC, nACtoMint);
    }

    /**
     * @notice get amount of Collateral Token available to redeem
     * @dev because it is a view function we are not calculating the new ema,
     *  since we are using the last ema calculation, this may differ a little from the real amount
     *  of TC available to redeem. Consider it an approximation.
     * @return tcAvailableToRedeem [N]
     */
    function getTCAvailableToRedeem() external view returns (uint256 tcAvailableToRedeem) {
        uint256 ctargemaCA = _getCtargemaCA();
        uint256 lckAC = _getLckAC();
        uint256 nACtoMint = _getACtoMint(lckAC);
        return _getTCAvailableToRedeem(ctargemaCA, lckAC, nACtoMint);
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
        uint256 ctargemaCA = _getCtargemaCA();
        uint256 ctargemaTP = _getCtargemaTP(i_, pACtp);
        uint256 lckAC = _getLckAC();
        uint256 nACtoMint = _getACtoMint(lckAC);
        return _getTPAvailableToMint(ctargemaCA, ctargemaTP, pACtp, lckAC, nACtoMint);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
