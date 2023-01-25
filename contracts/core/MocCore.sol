// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import "./MocStorage.sol";
import "./MocCoreExpansion.sol";

/**
 * @title MocCore
 * @notice MocCore nucleates all the basic MoC functionality and tool set. It allows Collateral
 * asset aware contracts to implement the main mint/redeem operations.
 */
abstract contract MocCore is MocStorage {
    // ------- Events -------
    event TCMinted(
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_
    );
    event TCRedeemed(
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_
    );
    event TPMinted(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_
    );
    event TPSwappedForTP(
        uint256 indexed iFrom_,
        uint256 iTo_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTPfrom_,
        uint256 qTPto_,
        uint256 qACfee_,
        uint256 qFeeToken_
    );
    event TPSwappedForTC(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qTC_,
        uint256 qACfee_,
        uint256 qFeeToken_
    );
    event TCSwappedForTP(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACfee_,
        uint256 qFeeToken_
    );
    event TCandTPRedeemed(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_
    );
    event TCandTPMinted(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_
    );
    event SuccessFeeDistributed(uint256 mocGain_, uint256[] tpGain_);
    event SettlementExecuted();
    // ------- Custom Errors -------
    error InsufficientQacSent(uint256 qACsent_, uint256 qACNeeded_);
    error QacBelowMinimumRequired(uint256 qACmin_, uint256 qACtoRedeem_);
    error InsufficientTPtoMint(uint256 qTP_, uint256 tpAvailableToMint_);
    error InsufficientTCtoRedeem(uint256 qTC_, uint256 tcAvailableToRedeem_);
    error QacNeededMustBeGreaterThanZero();
    error QtpBelowMinimumRequired(uint256 qTPmin_, uint256 qTP_);
    error QtcBelowMinimumRequired(uint256 qTCmin_, uint256 qTC_);
    error InsufficientQtpSent(uint256 qTPsent_, uint256 qTPNeeded_);
    error MissingBlocksToSettlement();
    // ------- Structs -------

    struct InitializeCoreParams {
        InitializeBaseBucketParams initializeBaseBucketParams;
        // The address that will define when a change contract is authorized
        address governorAddress;
        // The address that is authorized to pause this contract
        address pauserAddress;
        // Moc Core Expansion contract address
        address mocCoreExpansion;
        // amount of blocks to wait between Pegged ema calculation
        uint256 emaCalculationBlockSpan;
    }

    // ------- Storage -------
    // Moc Core Expansion contract address, used to expand 24kb size limit
    address internal mocCoreExpansion;

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @dev this function must be execute by the AC implementation at initialization
     * @param initializeCoreParams_ contract initializer params
     *        governorAddress The address that will define when a change contract is authorized
     *        pauserAddress_ The address that is authorized to pause this contract
     *        mocCoreExpansion Moc Core Expansion contract address
     *        feeTokenAddress Fee Token contract address
     *        feeTokenPriceProviderAddress Fee Token price provider contract address
     *        tcTokenAddress Collateral Token contract address
     *        mocFeeFlowAddress Moc Fee Flow contract address
     *        mocAppreciationBeneficiaryAddress Moc appreciation beneficiary address
     *        protThrld protected state threshold [PREC]
     *        liqThrld liquidation coverage threshold [PREC]
     *        feeRetainer pct retain on fees to be re-injected as Collateral, while paying fees with AC [PREC]
     *        tcMintFee additional fee pct applied on mint Collateral Tokens operations [PREC]
     *        tcRedeemFee additional fee pct applied on redeem Collateral Tokens operations [PREC]
     *        swapTPforTPFee additional fee pct applied on swap a Pegged Token for another Pegged Token [PREC]
     *        swapTPforTCFee additional fee pct applied on swap a Pegged Token for Collateral Token [PREC]
     *        swapTCforTPFee additional fee pct applied on swap Collateral Token for a Pegged Token [PREC]
     *        redeemTCandTPFee additional fee pct applied on redeem Collateral Token and Pegged Token [PREC]
     *        mintTCandTPFee additional fee pct applied on mint Collateral Token and Pegged Token [PREC]
     *        feeTokenPct pct applied on the top of the operation`s fee when using
     *          Fee Token as fee payment method [PREC]
     *        successFee pct of the gain because Pegged Tokens devaluation that is transferred
     *          in Collateral Asset to Moc Fee Flow during the settlement [PREC]
     *        appreciationFactor pct of the gain because Pegged Tokens devaluation that is returned
     *          in Pegged Tokens to appreciation beneficiary during the settlement [PREC]]
     *        emaCalculationBlockSpan amount of blocks to wait between Pegged ema calculation
     */
    function __MocCore_init(InitializeCoreParams calldata initializeCoreParams_) internal onlyInitializing {
        mocCoreExpansion = initializeCoreParams_.mocCoreExpansion;
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
     * @notice hook before any AC reception involving operation
     * @dev this function must be overridden by the AC implementation
     * @param qACMax_ max amount of AC available
     * @param qACNeeded_ amount of AC needed
     * @return change amount needed to be return to the sender after the operation is complete
     */
    function _onACNeededOperation(uint256 qACMax_, uint256 qACNeeded_) internal virtual returns (uint256 change);

    struct MintTCParams {
        uint256 qTC;
        uint256 qACmax;
        address sender;
        address recipient;
    }

    /**
     * @notice mint Collateral Token in exchange for Collateral Asset
     * @param params_ mintTCto function params
     * @dev
     *      qTC_ amount of Collateral Token to mint
     *      qACmax_ maximum amount of Collateral Asset that can be spent
     *      sender_ address who sends the Collateral Asset, all unspent amount is returned to it
     *      recipient_ address who receives the Collateral Token
     * @return qACtotalNeeded amount of AC used to mint qTC
     * @return qFeeToken amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */

    function _mintTCto(
        MintTCParams memory params_
    ) internal notLiquidated notPaused returns (uint256 qACtotalNeeded, uint256 qFeeToken) {
        uint256[] memory pACtps = _getPACtps();
        // evaluates whether or not the system coverage is healthy enough to mint TC, reverts if it's not
        (uint256 lckAC, uint256 nACgain) = _evalCoverage(protThrld, pACtps);
        // calculates how many qAC are needed to mint TC
        // [N] = [N] * [PREC] / [PREC]
        uint256 qACNeededtoMint = _mulPrec(params_.qTC, _getPTCac(lckAC, nACgain));
        uint256 qACFee;
        (qACtotalNeeded, qACFee, qFeeToken) = _calcFees(params_.sender, qACNeededtoMint, tcMintFee, true);
        if (qACtotalNeeded > params_.qACmax) revert InsufficientQacSent(params_.qACmax, qACtotalNeeded);
        // if is 0 reverts because it is trying to redeem an amount below precision
        if (qACtotalNeeded == 0) revert QacNeededMustBeGreaterThanZero();
        emit TCMinted(params_.sender, params_.recipient, params_.qTC, qACtotalNeeded, qACFee, qFeeToken);
        _depositAndMintTC(params_.qTC, qACNeededtoMint, params_.recipient);
        uint256 acChange = _onACNeededOperation(params_.qACmax, qACtotalNeeded);
        // transfers any AC change to the sender and distributes fees
        _distOpResults(params_.sender, acChange, qACFee, qFeeToken);
        return (qACtotalNeeded, qFeeToken);
    }

    struct RedeemTCParams {
        uint256 qTC;
        uint256 qACmin;
        address sender;
        address recipient;
    }

    /**
     * @notice redeem Collateral Asset in exchange for Collateral Token
     * @param params_ redeemTCto function params
     * @dev
     *      qTC_ amount of Collateral Token to redeem
     *      qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     *      sender_ address who sends the Collateral Token
     *      recipient_ address who receives the Collateral Asset
     * @return qACtoRedeem amount of AC sent to `recipient_`
     * @return qFeeToken amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */

    function _redeemTCto(
        RedeemTCParams memory params_
    ) internal notLiquidated notPaused returns (uint256 qACtoRedeem, uint256 qFeeToken) {
        (uint256 ctargemaCA, uint256[] memory pACtps) = _updateEmasAndCalcCtargemaCA();
        // evaluates whether or not the system coverage is healthy enough to redeem TC
        // given the target coverage adjusted by the moving average, reverts if it's not
        (uint256 lckAC, uint256 nACgain) = _evalCoverage(ctargemaCA, pACtps);
        // evaluates if there are enough Collateral Tokens available to redeem, reverts if there are not
        _evalTCAvailableToRedeem(params_.qTC, ctargemaCA, lckAC, nACgain);
        // calculate how many total qAC are redeemed
        // [N] = [N] * [PREC] / [PREC]
        uint256 qACtotalToRedeem = _mulPrec(params_.qTC, _getPTCac(lckAC, nACgain));
        // if is 0 reverts because it is trying to redeem an amount below precision
        if (qACtotalToRedeem == 0) revert QacNeededMustBeGreaterThanZero();
        uint256 qACFee;
        (qACtoRedeem, qACFee, qFeeToken) = _calcFees(params_.sender, qACtotalToRedeem, tcRedeemFee, false);
        if (qACtoRedeem < params_.qACmin) revert QacBelowMinimumRequired(params_.qACmin, qACtoRedeem);
        emit TCRedeemed(params_.sender, params_.recipient, params_.qTC, qACtoRedeem, qACFee, qFeeToken);
        _withdrawAndBurnTC(params_.qTC, qACtotalToRedeem, params_.sender);
        // transfers qAC to the recipient and distributes fees
        _distOpResults(params_.recipient, qACtoRedeem, qACFee, qFeeToken);
        return (qACtoRedeem, qFeeToken);
    }

    struct MintTPParams {
        uint256 i;
        uint256 qTP;
        uint256 qACmax;
        address sender;
        address recipient;
    }

    /**
     * @notice mint Pegged Token in exchange for Collateral Asset
     * @param params_ mint TP function params
     * @dev
     *      i_ Pegged Token index
     *      qTP_ amount of Pegged Token to mint
     *      qACmax_ maximum amount of Collateral Asset that can be spent
     *      sender_ address who sends the Collateral Asset, all unspent amount is returned to it
     *      recipient_ address who receives the Pegged Token
     * @return qACtotalNeeded amount of AC used to mint qTP
     * @return qFeeToken amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */
    function _mintTPto(
        MintTPParams memory params_
    ) internal notLiquidated notPaused returns (uint256 qACtotalNeeded, uint256 qFeeToken) {
        (uint256 ctargemaCA, uint256[] memory pACtps) = _updateEmasAndCalcCtargemaCA();
        uint256 pACtp = pACtps[params_.i];
        _updateTPtracking(params_.i, pACtp);
        // evaluates whether or not the system coverage is healthy enough to mint TP
        // given the target coverage adjusted by the moving average, reverts if it's not
        (uint256 lckAC, uint256 nACgain) = _evalCoverage(ctargemaCA, pACtps);
        // evaluates if there are enough TP available to mint, reverts if it's not
        _evalTPavailableToMint(params_.i, params_.qTP, pACtp, ctargemaCA, lckAC, nACgain);
        // calculate how many qAC are needed to mint TP
        // [N] = [N] * [PREC] / [PREC]
        uint256 qACNeededtoMint = _divPrec(params_.qTP, pACtp);
        uint256 qACFee;
        (qACtotalNeeded, qACFee, qFeeToken) = _calcFees(params_.sender, qACNeededtoMint, tpMintFee[params_.i], true);
        if (qACtotalNeeded > params_.qACmax) revert InsufficientQacSent(params_.qACmax, qACtotalNeeded);
        // if is 0 reverts because it is trying to mint an amount below precision
        if (qACtotalNeeded == 0) revert QacNeededMustBeGreaterThanZero();
        emit TPMinted(params_.i, params_.sender, params_.recipient, params_.qTP, qACtotalNeeded, qACFee, qFeeToken);
        // update bucket and mint
        _depositAndMintTP(params_.i, params_.qTP, qACNeededtoMint, params_.recipient);
        uint256 acChange = _onACNeededOperation(params_.qACmax, qACtotalNeeded);
        // transfers any AC change to the sender and distributes fees
        _distOpResults(params_.sender, acChange, qACFee, qFeeToken);
        return (qACtotalNeeded, qFeeToken);
    }

    struct RedeemTPParams {
        uint256 i;
        uint256 qTP;
        uint256 qACmin;
        address sender;
        address recipient;
    }

    /**
     * @notice redeem Collateral Asset in exchange for Pegged Token
     * @param params_ redeem CA function parameters
     * @dev
     *      i_ Pegged Token index
     *      qTP_ amount of Pegged Token to redeem
     *      qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     *      sender_ address who sends the Pegged Token
     *      recipient_ address who receives the Collateral Asset
     * @return qACtoRedeem amount of AC sent to `recipient_`
     * @return qFeeToken amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */
    function _redeemTPto(
        RedeemTPParams memory params_
    ) internal notLiquidated notPaused returns (uint256 qACtoRedeem, uint256 qFeeToken) {
        uint256[] memory pACtps = _getPACtps();
        uint256 pACtp = pACtps[params_.i];
        _updateTPtracking(params_.i, pACtp);
        // evaluates whether or not the system coverage is healthy enough to redeem TP, reverts if it's not
        _evalCoverage(protThrld, pACtps);
        // calculate how many total qAC are redeemed
        // [N] = [N] * [PREC] / [PREC]
        uint256 qACtotalToRedeem = _divPrec(params_.qTP, pACtp);
        uint256 qACFee;
        (qACtoRedeem, qACFee, qFeeToken) = _calcFees(params_.sender, qACtotalToRedeem, tpRedeemFee[params_.i], false);
        // if is 0 reverts because it is trying to redeem an amount below precision
        if (qACtotalToRedeem == 0) revert QacNeededMustBeGreaterThanZero();
        if (qACtoRedeem < params_.qACmin) revert QacBelowMinimumRequired(params_.qACmin, qACtoRedeem);
        emit TPRedeemed(params_.i, params_.sender, params_.recipient, params_.qTP, qACtoRedeem, qACFee, qFeeToken);
        _withdrawAndBurnTP(params_.i, params_.qTP, qACtotalToRedeem, params_.sender);
        // transfers qAC to the recipient and distributes fees
        _distOpResults(params_.recipient, qACtoRedeem, qACFee, qFeeToken);
        return (qACtoRedeem, qFeeToken);
    }

    struct MintTCandTPParams {
        uint256 i;
        uint256 qTP;
        uint256 qACmax;
        address sender;
        address recipient;
    }

    /**
     * @notice mint Collateral Token and Pegged Token in exchange for Collateral Asset
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are minted in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qAC sent are insufficient.
     * @param params_ mint TC and TP function parameters
     * @dev
     *      i_ Pegged Token index
     *      qTP_ amount of Pegged Token to mint
     *      qACmax_ maximum amount of Collateral Asset that can be spent
     *      sender_ address who sends Collateral Asset
     *      recipient_ address who receives the Collateral Token and Pegged Token
     * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
     * @return qTCtoMint amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */
    function _mintTCandTPto(
        MintTCandTPParams memory params_
    ) internal notLiquidated notPaused returns (uint256 qACtotalNeeded, uint256 qTCtoMint, uint256 qFeeToken) {
        uint256 qACNeededtoMint;
        (uint256 ctargemaCA, uint256[] memory pACtps) = _updateEmasAndCalcCtargemaCA();
        uint256 pACtp = pACtps[params_.i];
        _updateTPtracking(params_.i, pACtp);
        // evaluates that the system is not below the liquidation threshold
        // one of the reasons is to prevent it from failing due to underflow because the lckAC > totalACavailable
        _evalCoverage(liqThrld, pACtps);
        (qTCtoMint, qACNeededtoMint) = _calcQACforMintTCandTP(params_.qTP, pACtp, ctargemaCA, pACtps);
        uint256 qACFee;
        (qACtotalNeeded, qACFee, qFeeToken) = _calcFees(params_.sender, qACNeededtoMint, mintTCandTPFee, true);
        if (qACtotalNeeded > params_.qACmax) revert InsufficientQacSent(params_.qACmax, qACtotalNeeded);
        // if is 0 reverts because it is trying to mint an amount below precision
        if (qACtotalNeeded == 0) revert QacNeededMustBeGreaterThanZero();
        emit TCandTPMinted(
            params_.i,
            params_.sender,
            params_.recipient,
            qTCtoMint,
            params_.qTP,
            qACtotalNeeded,
            qACFee,
            qFeeToken
        );
        _depositAndMintTC(qTCtoMint, qACNeededtoMint, params_.recipient);
        _depositAndMintTP(params_.i, params_.qTP, 0, params_.recipient);
        uint256 acChange = _onACNeededOperation(params_.qACmax, qACtotalNeeded);
        // transfers qAC to the sender and distributes fees
        _distOpResults(params_.sender, acChange, qACFee, qFeeToken);
        return (qACtotalNeeded, qTCtoMint, qFeeToken);
    }

    struct RedeemTCandTPParams {
        uint256 i;
        uint256 qTC;
        uint256 qTP;
        uint256 qACmin;
        address sender;
        address recipient;
    }

    /**
     * @notice redeem Collateral Asset in exchange for Collateral Token and Pegged Token
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param params_ redeem TC and TP function parameters
     * @dev
     *      i_ Pegged Token index
     *      qTC_ amount of Collateral Token to redeem
     *      qTP_ maximum amount of Pegged Token to redeem
     *      qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     *      sender_ address who sends Collateral Token and Pegged Token
     *      recipient_ address who receives the Collateral Asset
     * @return qACtoRedeem amount of AC sent to `recipient_`
     * @return qTPtoRedeem amount of Pegged Token redeemed
     * @return qFeeToken amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */
    function _redeemTCandTPto(
        RedeemTCandTPParams memory params_
    ) internal notLiquidated notPaused returns (uint256 qACtoRedeem, uint256 qTPtoRedeem, uint256 qFeeToken) {
        uint256[] memory pACtps = _getPACtps();
        uint256 pACtp = pACtps[params_.i];
        _updateTPtracking(params_.i, pACtp);
        // evaluates that the system is not below the liquidation threshold
        // one of the reasons is to prevent it from failing due to underflow because the lckAC > totalACavailable
        (uint256 lckAC, uint256 nACgain) = _evalCoverage(liqThrld, pACtps);
        // calculate how many TP are needed to redeem TC and not change coverage
        // qTPtoRedeem = (qTC * pACtp * pTCac) / (cglb - 1)
        // pTCac = (totalACavailable - lckAC) / nTCcb
        // cglb = totalACavailable / lckAC => cglb - 1 = (totalACavailable - lckAC) / lckAC
        // qTPtoRedeem = (qTC * pACtp * (totalACavailable - lckAC) / nTCcb) / ((totalACavailable - lckAC) / lckAC)
        // So, we can simplify (totalACavailable - lckAC)
        // qTPtoRedeem = (qTC * pACtp * lckAC) / nTCcb
        // [N] = ([N] * [N] * [PREC] / [N]) /  [PREC]
        qTPtoRedeem = ((params_.qTC * lckAC * pACtp) / nTCcb) / PRECISION;

        if (qTPtoRedeem > params_.qTP) revert InsufficientQtpSent(params_.qTP, qTPtoRedeem);
        uint256 qACtotalToRedeem = _calcQACforRedeemTCandTP(params_.qTC, qTPtoRedeem, pACtp, _getPTCac(lckAC, nACgain));
        uint256 qACFee;
        (qACtoRedeem, qACFee, qFeeToken) = _calcFees(params_.sender, qACtotalToRedeem, redeemTCandTPFee, false);
        if (qACtoRedeem < params_.qACmin) revert QacBelowMinimumRequired(params_.qACmin, qACtoRedeem);
        // if is 0 reverts because it is trying to redeem an amount below precision
        if (qACtoRedeem == 0) revert QacNeededMustBeGreaterThanZero();
        emit TCandTPRedeemed(
            params_.i,
            params_.sender,
            params_.recipient,
            params_.qTC,
            qTPtoRedeem,
            qACtoRedeem,
            qACFee,
            qFeeToken
        );

        _withdrawAndBurnTC(params_.qTC, qACtotalToRedeem, params_.sender);
        _withdrawAndBurnTP(params_.i, qTPtoRedeem, 0, params_.sender);

        // transfers qAC to the recipient and distributes fees
        _distOpResults(params_.recipient, qACtoRedeem, qACFee, qFeeToken);
        return (qACtoRedeem, qTPtoRedeem, qFeeToken);
    }

    struct SwapTPforTPParams {
        uint256 iFrom;
        uint256 iTo;
        uint256 qTP;
        uint256 qTPmin;
        uint256 qACmax;
        address sender;
        address recipient;
    }

    /**
     * @notice swap Pegged Token to another one
     *  This operation is done without checking coverage unless the target coverage for
     *  received Pegged Token is greater than the Pegged Token sent
     * @param params_ swap TP for TP function parameters
     * @dev
     *      iFrom_ owned Pegged Token index
     *      iTo_ target Pegged Token index
     *      qTP_ amount of owned Pegged Token to swap
     *      qTPmin_ minimum amount of target Pegged Token that `recipient_` expects to receive
     *      qACmax_ maximum amount of Collateral Asset that can be spent in fees
     *      sender_ address who sends the Pegged Token
     *      recipient_ address who receives the target Pegged Token
     * @return qACFee amount of AC used to pay fee
     * @return qTPtoMint amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */
    function _swapTPforTPto(
        SwapTPforTPParams memory params_
    ) internal notLiquidated notPaused returns (uint256 qACFee, uint256 qTPtoMint, uint256 qFeeToken) {
        if (params_.iFrom == params_.iTo) revert InvalidValue();
        uint256 pACtpFrom = getPACtp(params_.iFrom);
        uint256 pACtpTo = getPACtp(params_.iTo);
        _updateTPtracking(params_.iFrom, pACtpFrom);
        _updateTPtracking(params_.iTo, pACtpTo);
        // calculate how many total qAC are redeemed
        // [N] = [N] * [PREC] / [PREC]
        uint256 qACtotalToRedeem = _divPrec(params_.qTP, pACtpFrom);
        // calculate how many qTP can mint with the given qAC
        // [N] = [N] * [PREC] / [PREC]
        qTPtoMint = (params_.qTP * pACtpTo) / pACtpFrom;
        if (qTPtoMint < params_.qTPmin || qTPtoMint == 0) revert QtpBelowMinimumRequired(params_.qTPmin, qTPtoMint);

        // if ctargemaTPto > ctargemaTPfrom we need to check coverage
        if (_getCtargemaTP(params_.iTo, pACtpTo) > _getCtargemaTP(params_.iFrom, pACtpFrom)) {
            (uint256 ctargemaCA, uint256[] memory pACtps) = _updateEmasAndCalcCtargemaCA();
            // evaluates whether or not the system coverage is healthy enough to mint TP
            // given the target coverage adjusted by the moving average, reverts if it's not
            (uint256 lckAC, uint256 nACgain) = _evalCoverage(ctargemaCA, pACtps);
            // evaluates if there are enough TP available to mint, reverts if it's not
            _evalTPavailableToMint(params_.iTo, qTPtoMint, pACtpTo, ctargemaCA, lckAC, nACgain);
        }
        (, qACFee, qFeeToken) = _calcFees(params_.sender, qACtotalToRedeem, swapTPforTPFee, false);
        if (qACFee > params_.qACmax) revert InsufficientQacSent(params_.qACmax, qACFee);
        emit TPSwappedForTP(
            params_.iFrom,
            params_.iTo,
            params_.sender,
            params_.recipient,
            params_.qTP,
            qTPtoMint,
            qACFee,
            qFeeToken
        );

        _depositAndMintTP(params_.iTo, qTPtoMint, 0, params_.recipient);
        _withdrawAndBurnTP(params_.iFrom, params_.qTP, 0, params_.sender);

        // AC is only used to pay fees
        uint256 acChange = _onACNeededOperation(params_.qACmax, qACFee);
        // transfer any qAC change to the sender and distribute fees
        _distOpResults(params_.sender, acChange, qACFee, qFeeToken);
        return (qACFee, qTPtoMint, qFeeToken);
    }

    struct SwapTPforTCParams {
        uint256 i;
        uint256 qTP;
        uint256 qTCmin;
        uint256 qACmax;
        address sender;
        address recipient;
    }

    /**
     * @notice swap Pegged Token to Collateral Token
     * @param params_ swap TP for TC function parameters
     * @dev
     *      i_ Pegged Token index
     *      qTP_ amount Pegged Token to swap
     *      qTCmin_ minimum amount of Collateral Token that `recipient_` expects to receive
     *      qACmax_ maximum amount of Collateral Asset that can be spent in fees
     *      sender_ address who sends the Pegged Token
     *      recipient_ address who receives Collateral Token
     * @return qACFee amount of AC used to pay fee
     * @return qTCtoMint amount of Collateral Token minted
     * @return qFeeToken amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */
    function _swapTPforTCto(
        SwapTPforTCParams memory params_
    ) internal notLiquidated notPaused returns (uint256 qACFee, uint256 qTCtoMint, uint256 qFeeToken) {
        uint256[] memory pACtps = _getPACtps();
        uint256 pACtp = pACtps[params_.i];
        _updateTPtracking(params_.i, pACtp);
        // evaluates whether or not the system coverage is healthy enough to mint TC, reverts if it's not
        (uint256 lckAC, uint256 nACgain) = _evalCoverage(protThrld, pACtps);
        // calculate how many total qAC are redeemed TP
        // [N] = [N] * [PREC] / [PREC]
        uint256 qACtotalToRedeem = _divPrec(params_.qTP, pACtp);
        // calculate how many qTC can mint with the given qAC
        // qTCtoMint = qTP / pTCac / pACtp
        // [N] = [N] * [N] * [PREC] / ([N] - [N]) * [PREC]
        qTCtoMint = _divPrec(params_.qTP * nTCcb, (_getTotalACavailable(nACgain) - lckAC) * pACtp);
        if (qTCtoMint < params_.qTCmin || qTCtoMint == 0) revert QtcBelowMinimumRequired(params_.qTCmin, qTCtoMint);

        (, qACFee, qFeeToken) = _calcFees(params_.sender, qACtotalToRedeem, swapTPforTCFee, false);
        if (qACFee > params_.qACmax) revert InsufficientQacSent(params_.qACmax, qACFee);
        emit TPSwappedForTC(params_.i, params_.sender, params_.recipient, params_.qTP, qTCtoMint, qACFee, qFeeToken);

        _withdrawAndBurnTP(params_.i, params_.qTP, 0, params_.sender);
        _depositAndMintTC(qTCtoMint, 0, params_.recipient);

        // AC is only used to pay fees
        uint256 acChange = _onACNeededOperation(params_.qACmax, qACFee);
        // transfer any qAC change to the sender and distribute fees
        _distOpResults(params_.sender, acChange, qACFee, qFeeToken);
        return (qACFee, qTCtoMint, qFeeToken);
    }

    struct SwapTCforTPParams {
        uint256 i;
        uint256 qTC;
        uint256 qTPmin;
        uint256 qACmax;
        address sender;
        address recipient;
    }

    /**
     * @notice swap Collateral Token to Pegged Token
     * @param params_ swap TC for TP function parameters
     * @dev
     *      i_ Pegged Token index
     *      qTC_ amount of Collateral Token to swap
     *      qTPmin_ minimum amount of Pegged Token Token that `recipient_` expects to receive
     *      qACmax_ maximum amount of Collateral Asset that can be spent in fees
     *      sender_ address who sends the Collateral Token
     *      recipient_ address who receives the Pegged Token
     * @return qACFee amount of AC used to pay fee
     * @return qTPtoMint amount of Pegged Token minted
     * @return qFeeToken amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */
    function _swapTCforTPto(
        SwapTCforTPParams memory params_
    ) internal notLiquidated notPaused returns (uint256 qACFee, uint256 qTPtoMint, uint256 qFeeToken) {
        (uint256 ctargemaCA, uint256[] memory pACtps) = _updateEmasAndCalcCtargemaCA();
        uint256 pACtp = pACtps[params_.i];
        _updateTPtracking(params_.i, pACtp);
        // evaluates whether or not the system coverage is healthy enough to redeem TC
        // given the target coverage adjusted by the moving average, reverts if it's not
        (uint256 lckAC, uint256 nACgain) = _evalCoverage(ctargemaCA, pACtps);
        // evaluates if there are enough Collateral Tokens available to redeem, reverts if there are not
        _evalTCAvailableToRedeem(params_.qTC, ctargemaCA, lckAC, nACgain);
        // calculate how many total qAC are redeemed
        // [N] = [N] * [PREC] / [PREC]
        uint256 qACtotalToRedeem = _mulPrec(params_.qTC, _getPTCac(lckAC, nACgain));
        // if is 0 reverts because it is trying to swap an amount below precision
        if (qACtotalToRedeem == 0) revert QacNeededMustBeGreaterThanZero();
        // calculate how many qTP can mint with the given qAC
        // qTPtoMint = qTC * pTCac * pACtp
        // [N] = ([N] * ([N] - [N]) * [PREC] / [N]) / [PREC]
        qTPtoMint = ((params_.qTC * (_getTotalACavailable(nACgain) - lckAC) * pACtp) / nTCcb) / PRECISION;
        // evaluates if there are enough TP available to mint, reverts if it's not
        _evalTPavailableToMint(params_.i, qTPtoMint, pACtp, ctargemaCA, lckAC, nACgain);
        if (qTPtoMint < params_.qTPmin) revert QtpBelowMinimumRequired(params_.qTPmin, qTPtoMint);

        (, qACFee, qFeeToken) = _calcFees(params_.sender, qACtotalToRedeem, swapTCforTPFee, false);
        if (qACFee > params_.qACmax) revert InsufficientQacSent(params_.qACmax, qACFee);
        emit TCSwappedForTP(params_.i, params_.sender, params_.recipient, params_.qTC, qTPtoMint, qACFee, qFeeToken);

        _withdrawAndBurnTC(params_.qTC, 0, params_.sender);
        _depositAndMintTP(params_.i, qTPtoMint, 0, params_.recipient);

        // AC is only used to pay fees
        uint256 acChange = _onACNeededOperation(params_.qACmax, qACFee);
        // transfer any qAC change to the sender and distribute fees
        _distOpResults(params_.sender, acChange, qACFee, qFeeToken);
        return (qACFee, qTPtoMint, qFeeToken);
    }

    /**
     * @notice Allow redeem on liquidation state, user Peg balance gets burned and he receives
     * the equivalent AC given the liquidation frozen price.
     * @dev This function is implemented in MocCoreExpansion but with this contract context
     * @param i_ Pegged Token index
     * @param sender_ address owner of the TP to be redeemed
     * @param recipient_ address who receives the AC
     * @return qACRedeemed amount of AC sent to `recipient_`
     */
    function _liqRedeemTPTo(
        uint256 i_,
        address sender_,
        address recipient_
    ) internal notPaused returns (uint256 qACRedeemed) {
        bytes memory payload = abi.encodeCall(
            MocCoreExpansion(mocCoreExpansion).liqRedeemTPTo,
            (i_, sender_, recipient_, acBalanceOf(address(this)))
        );
        qACRedeemed = abi.decode(Address.functionDelegateCall(mocCoreExpansion, payload), (uint256));
        // transfer qAC to the recipient, reverts if fail
        acTransfer(recipient_, qACRedeemed);
        return qACRedeemed;
    }

    /**
     * @notice Distributes Operation results to the different recipients
     * @param operatorsAddress_ operator's address to receive `operatorsQAC_`
     * @param operatorsQAC_ amount of AC to transfer operator [N]
     */
    function _distOpResults(
        address operatorsAddress_,
        uint256 operatorsQAC_,
        uint256 qACFee_,
        uint256 qFeeToken_
    ) internal {
        // transfer Fee Token to Moc Fee Flow
        if (qFeeToken_ > 0)
            SafeERC20.safeTransferFrom(feeToken, operatorsAddress_, mocFeeFlowAddress, qFeeToken_);
            // if qFeeToken == 0 then the fees are paid in AC and a part is retained
        else {
            // [N] = [PREC] * [N] / [PREC]
            uint256 qACFeeRetained = _mulPrec(feeRetainer, qACFee_);
            // Increase collateral in the retain amount
            nACcb += qACFeeRetained;
            // transfer qAC fee to Moc Fee Flow
            acTransfer(mocFeeFlowAddress, qACFee_ - qACFeeRetained);
        }
        // transfer qAC to operator
        acTransfer(operatorsAddress_, operatorsQAC_);
    }

    /**
     * @notice calc fees amount in qAC or Fee Token
     *  If `sender_` has enough Fee Token to pay fees, will be used. In another case will use qAC
     * @dev if qFeeToken > 0, qACFee = 0. If qACFee > 0, qFeeToken = 0.
     * @param sender_ address who executes the operation
     * @param qAC_ amount of AC involved in the operation, could be sent form sender for mint or
     *  sent to recipient for redeem [N]
     * @param qACFeePct_ additional fee pct applied on operation
     * @param operationType_ true: minting, false: redeeming
     * @return qACtotalNeeded amount of qAC needed for the operation.
     *  When minting is qAC + qACFee, when redeeming is qAC - qACFee
     * @return qACFee amount of qAC needed to pay fees
     * @return qFeeToken amount of Fee Token needed to pay fess
     */
    function _calcFees(
        address sender_,
        uint256 qAC_,
        uint256 qACFeePct_,
        bool operationType_
    ) internal view returns (uint256 qACtotalNeeded, uint256 qACFee, uint256 qFeeToken) {
        qACtotalNeeded = qAC_;
        uint256 senderAllowance = feeToken.allowance(sender_, address(this));
        if (senderAllowance > 0) {
            (uint256 feeTokenPrice, bool hasFeeTokenPrice) = _peekPrice(feeTokenPriceProvider);
            if (hasFeeTokenPrice) {
                // calculates Fee Token to be charged as fee
                // [N] = ([N] * [PREC] * [PREC] / [PREC]) / [PREC]
                // TODO: define if will not be necessary a feeTokenPct for each operation
                qFeeToken = _mulPrec(qAC_ * qACFeePct_, feeTokenPct) / feeTokenPrice;
                // TODO: if feeTokenPct == 0 should use qAC too?
                if (senderAllowance < qFeeToken || feeToken.balanceOf(sender_) < qFeeToken) {
                    qFeeToken = 0;
                }
            }
        }
        // if sender hasn't got enough feeToken balance or allowance or price provider hasn't got a valid price
        // then qFeeToken == 0 and sender pays fees with AC
        if (qFeeToken == 0) {
            // calculates qAC to be charged as fee
            // [N] = [N] * [PREC] / [PREC]
            qACFee = _mulPrec(qAC_, qACFeePct_);
            if (operationType_) {
                // if it is a mint operation add fee to qAC total needed to mint
                qACtotalNeeded = qAC_ + qACFee;
            } else {
                // if it is a redeem operation sub fee to qAC total claimed
                qACtotalNeeded = qAC_ - qACFee;
            }
        }
        return (qACtotalNeeded, qACFee, qFeeToken);
    }

    // ------- Public Functions -------

    /**
     * @notice caller sends Collateral Token and receives Collateral Asset
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @return qACRedeemed amount of AC sent to sender
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTC(uint256 qTC_, uint256 qACmin_) external returns (uint256 qACRedeemed, uint256 qFeeToken) {
        RedeemTCParams memory params = RedeemTCParams({
            qTC: qTC_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: msg.sender
        });
        return _redeemTCto(params);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Collateral Asset
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @return qACRedeemed amount of AC sent to 'recipient_'
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTCto(
        uint256 qTC_,
        uint256 qACmin_,
        address recipient_
    ) external returns (uint256 qACRedeemed, uint256 qFeeToken) {
        RedeemTCParams memory params = RedeemTCParams({
            qTC: qTC_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: recipient_
        });
        return _redeemTCto(params);
    }

    /**
     * @notice caller sends Pegged Token and receives Collateral Asset
     * @param i_ Pegged Token index to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @return qACRedeemed amount of AC sent to sender
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTP(
        uint256 i_,
        uint256 qTP_,
        uint256 qACmin_
    ) external returns (uint256 qACRedeemed, uint256 qFeeToken) {
        RedeemTPParams memory params = RedeemTPParams({
            i: i_,
            qTP: qTP_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: msg.sender
        });
        return _redeemTPto(params);
    }

    /**
     * @notice caller sends Pegged Token and recipient receives Collateral Asset
     * @param i_ Pegged Token index to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @return qACRedeemed amount of AC sent to 'recipient_'
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTPto(
        uint256 i_,
        uint256 qTP_,
        uint256 qACmin_,
        address recipient_
    ) external returns (uint256 qACRedeemed, uint256 qFeeToken) {
        RedeemTPParams memory params = RedeemTPParams({
            i: i_,
            qTP: qTP_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: recipient_
        });
        return _redeemTPto(params);
    }

    /**
     * @notice caller sends Collateral Token and Pegged Token and receives coinbase as Collateral Asset
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param i_ Pegged Token index
     * @param qTC_ maximum amount of Collateral Token to redeem
     * @param qTP_ maximum amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that the sender expects to receive
     * @return qACRedeemed amount of AC sent to the sender
     * @return qTPRedeemed amount of Pegged Token redeemed
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTCandTP(
        uint256 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACmin_
    ) external returns (uint256 qACRedeemed, uint256 qTPRedeemed, uint256 qFeeToken) {
        RedeemTCandTPParams memory params = RedeemTCandTPParams({
            i: i_,
            qTC: qTC_,
            qTP: qTP_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: msg.sender
        });
        return _redeemTCandTPto(params);
    }

    /**
     * @notice caller sends Collateral Token and Pegged Token and recipient receives Collateral Asset
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param i_ Pegged Token index
     * @param qTC_ maximum amount of Collateral Token to redeem
     * @param qTP_ maximum amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @return qACRedeemed amount of AC sent to the `recipient_`
     * @return qTPRedeemed amount of Pegged Token redeemed
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTCandTPto(
        uint256 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACmin_,
        address recipient_
    ) external returns (uint256 qACRedeemed, uint256 qTPRedeemed, uint256 qFeeToken) {
        RedeemTCandTPParams memory params = RedeemTCandTPParams({
            i: i_,
            qTC: qTC_,
            qTP: qTP_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: recipient_
        });
        return _redeemTCandTPto(params);
    }

    /**
     * @notice Allow redeem on liquidation state, user Peg balance gets burned and he receives
     * the equivalent AC given the liquidation frozen price.
     * @param i_ Pegged Token index
     * @return qACRedeemed amount of AC sent to sender
     */
    function liqRedeemTP(uint256 i_) external returns (uint256 qACRedeemed) {
        return _liqRedeemTPTo(i_, msg.sender, msg.sender);
    }

    /**
     * @notice Allow redeem on liquidation state, user Peg balance gets burned and he receives
     * the equivalent AC given the liquidation frozen price.
     * @param i_ Pegged Token index
     * @param recipient_ address who receives the AC
     * @return qACRedeemed amount of AC sent to `recipient_`
     */
    function liqRedeemTPto(uint256 i_, address recipient_) external returns (uint256 qACRedeemed) {
        return _liqRedeemTPTo(i_, msg.sender, recipient_);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to mint an amount of Collateral Token
     * and Pegged Token in one operation
     * @param qTP_ amount of Pegged Token to mint
     * @param pACtp_ Pegged Token price [PREC]
     * @return qTCtoMint amount of Collateral Token to mint [N]
     * @return qACNeededtoMint amount of Collateral Asset needed to mint [N]
     */
    function _calcQACforMintTCandTP(
        uint256 qTP_,
        uint256 pACtp_,
        uint256 ctargemaCA_,
        uint256[] memory pACtps_
    ) internal view returns (uint256 qTCtoMint, uint256 qACNeededtoMint) {
        (uint256 lckAC, uint256 nACgain) = _calcLckACandACgain(pACtps_);
        uint256 pTCac = _getPTCac(lckAC, nACgain);
        // calculate how many TC are needed to mint TP and total qAC used for mint both
        // [N] = [N] * ([PREC] - [PREC]) / [PREC]
        qACNeededtoMint = (qTP_ * (ctargemaCA_ - ONE)) / pACtp_;
        // [N] = [N] *  [PREC] / [PREC]
        qTCtoMint = _divPrec(qACNeededtoMint, pTCac);
        // [N] = [N] + [N] *  [PREC] / [PREC]
        qACNeededtoMint = qACNeededtoMint + _divPrec(qTP_, pACtp_);
        return (qTCtoMint, qACNeededtoMint);
    }

    /**
     * @notice calculate how many Collateral Asset are needed to redeem an amount of Collateral Token
     * and Pegged Token in one operation
     * @param qTC_ amount of Collateral Token to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param pACtp_ Pegged Token price [PREC]
     * @param pTCac_ Collateral Token price [PREC]
     * @return qACtotalToRedeem amount of Collateral Asset needed to redeem, including fees [N]
     */
    function _calcQACforRedeemTCandTP(
        uint256 qTC_,
        uint256 qTP_,
        uint256 pACtp_,
        uint256 pTCac_
    ) internal pure returns (uint256 qACtotalToRedeem) {
        // calculate how many total qAC are redeemed
        // [N] = [N] * [PREC] / [PREC]
        qACtotalToRedeem = _divPrec(qTP_, pACtp_);
        // calculate how many qAC are redeemed because TC
        // [N] = [N] * [PREC] / [PREC]
        // TODO: rounding error could be avoid replacing here with qTC_ * totalACavailable / nTCcb
        qACtotalToRedeem += _mulPrec(qTC_, pTCac_);
        return qACtotalToRedeem;
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
        uint256 i_,
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
        uint256 mocGain = 0;
        uint256 pegAmount = pegContainer.length;
        uint256[] memory tpToMint = new uint256[](pegAmount);
        for (uint256 i = 0; i < pegAmount; i = unchecked_inc(i)) {
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
                _depositAndMintTP(i, tpToMint[i], 0, mocAppreciationBeneficiaryAddress);
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

    // ------- External Functions -------

    /**
     * @notice this function is executed during settlement.
     *  stores amount of locked AC by Pegged Tokens at this moment and distribute success fee
     */

    function execSettlement() external notPaused {
        // check if it is in the corresponding block to execute the settlement
        if (block.number < bns) revert MissingBlocksToSettlement();
        bns = block.number + bes;
        emit SettlementExecuted();
        _distributeSuccessFee();
    }

    // ------- Only Authorized Changer Functions -------

    /**
     * @dev sets Moc Core Expansion contract address
     * @param mocCoreExpansion_ moc core expansion new contract address
     */
    function setMocCoreExpansion(address mocCoreExpansion_) external onlyAuthorizedChanger {
        // slither-disable-next-line missing-zero-check
        mocCoreExpansion = mocCoreExpansion_;
    }

    /**
     * @notice add a Pegged Token to the protocol
     * @dev Note that the ema value, should consider `nextEmaCalculation`
     *  This function is implemented in MocCoreExpansion but with this contract context
     * @param peggedTokenParams_ params of Pegged Token to add
     * @dev
     *      tpTokenAddress Pegged Token contract address to add
     *      priceProviderAddress Pegged Token price provider contract address
     *      tpCtarg Pegged Token target coverage [PREC]
     *      tpMintFee additional fee pct applied on mint [PREC]
     *      tpRedeemFee additional fee pct applied on redeem [PREC]
     *      tpEma initial Pegged Token exponential moving average [PREC]
     *      tpEmaSf Pegged Token smoothing factor [PREC]
     *
     *  Requirements:
     *
     * - the caller must have governance authorization.
     * - tpTokenAddress must be a MocRC20, with mint, burn roles already settled
     *  for this contract
     */
    function addPeggedToken(PeggedTokenParams calldata peggedTokenParams_) external onlyAuthorizedChanger {
        bytes memory payload = abi.encodeCall(MocCoreExpansion(mocCoreExpansion).addPeggedToken, (peggedTokenParams_));
        Address.functionDelegateCall(mocCoreExpansion, payload);
    }

    /**
     * @notice modifies a Pegged Token of the protocol
     * @dev Note that the ema value, should consider `nextEmaCalculation`
     *  This function is implemented in MocCoreExpansion but with this contract context
     * @param peggedTokenParams_ params of Pegged Token to add
     * @dev
     *      tpTokenAddress Pegged Token contract address to identify the token to edit
     *      priceProviderAddress Pegged Token price provider contract address
     *      tpCtarg Pegged Token target coverage [PREC]
     *      tpMintFee additional fee pct applied on mint [PREC]
     *      tpRedeemFee additional fee pct applied on redeem [PREC]
     *      tpEma initial Pegged Token exponential moving average [PREC]
     *      tpEmaSf Pegged Token smoothing factor [PREC]
     *
     *  Requirements:
     *
     * - the caller must have governance authorization.
     * - the tpTokenAddress must exists
     */
    function editPeggedToken(PeggedTokenParams calldata peggedTokenParams_) external onlyAuthorizedChanger {
        bytes memory payload = abi.encodeCall(MocCoreExpansion(mocCoreExpansion).editPeggedToken, (peggedTokenParams_));
        Address.functionDelegateCall(mocCoreExpansion, payload);
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
        (uint256 ctargemaCA, uint256[] memory pACtps) = _calcCtargemaCA();
        (uint256 lckAC, uint256 nACgain) = _calcLckACandACgain(pACtps);
        return _getTCAvailableToRedeem(ctargemaCA, lckAC, nACgain);
    }

    /**
     * @notice get amount of Pegged Token available to mint
     * @dev because it is a view function we are not calculating the new ema,
     *  since we are using the last ema calculation, this may differ a little from the real amount
     *  of TP available to mint. Consider it an approximation.
     * @param i_ Pegged Token index
     * @return tpAvailableToMint [N]
     */
    function getTPAvailableToMint(uint256 i_) external view returns (uint256 tpAvailableToMint) {
        (uint256 ctargemaCA, uint256[] memory pACtps) = _calcCtargemaCA();
        uint256 pACtp = pACtps[i_];
        (uint256 lckAC, uint256 nACgain) = _calcLckACandACgain(pACtps);
        return _getTPAvailableToMint(ctargemaCA, _getCtargemaTP(i_, pACtp), pACtp, lckAC, nACgain);
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
     * @notice get the number of blocks remaining for settlement
     */
    function getBts() external view returns (uint256) {
        if (block.number >= bns) return 0;
        return bns - block.number;
    }

    /**
     * @param bes_ number of blocks between settlements
     **/
    function setBes(uint256 bes_) external onlyAuthorizedChanger {
        bes = bes_;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
