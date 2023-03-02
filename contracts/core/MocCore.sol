// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import { MocCommons } from "./MocCommons.sol";
import { MocCoreExpansion } from "./MocCoreExpansion.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MocCore
 * @notice MocCore nucleates all the basic MoC functionality and tool set. It allows Collateral
 * asset aware contracts to implement the main mint/redeem operations.
 */
abstract contract MocCore is MocCommons {
    // ------- Events -------
    event TCMinted(
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_
    );
    event TCRedeemed(
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_
    );
    event TPMinted(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_
    );
    event TPSwappedForTC(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qTC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_
    );
    event TCSwappedForTP(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_
    );
    event TCandTPRedeemed(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_
    );
    event TCandTPMinted(
        uint256 indexed i_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qAC_,
        uint256 qACfee_,
        uint256 qFeeToken_,
        uint256 qACVendorMarkup_,
        uint256 qFeeTokenVendorMarkup_
    );
    event SuccessFeeDistributed(uint256 mocGain_, uint256[] tpGain_);
    event SettlementExecuted();
    // ------- Custom Errors -------
    error QacBelowMinimumRequired(uint256 qACmin_, uint256 qACtoRedeem_);
    error InsufficientTCtoRedeem(uint256 qTC_, uint256 tcAvailableToRedeem_);
    error QacNeededMustBeGreaterThanZero();
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
        // address for MocVendors
        address mocVendors;
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
     *        mocVendors address for MocVendors contract.
     */
    function __MocCore_init(InitializeCoreParams calldata initializeCoreParams_) internal onlyInitializing {
        mocCoreExpansion = initializeCoreParams_.mocCoreExpansion;
        __MocUpgradable_init(initializeCoreParams_.governorAddress, initializeCoreParams_.pauserAddress);
        __MocBaseBucket_init_unchained(initializeCoreParams_.initializeBaseBucketParams);
        __MocEma_init_unchained(initializeCoreParams_.emaCalculationBlockSpan);
        __MocCommons_init_unchained(initializeCoreParams_.mocVendors);
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
        address vendor;
    }

    /**
     * @notice mint Collateral Token in exchange for Collateral Asset
     * @param params_ mintTCto function params
     * @dev
     *      qTC_ amount of Collateral Token to mint
     *      qACmax_ maximum amount of Collateral Asset that can be spent
     *      sender_ address who sends the Collateral Asset, all unspent amount is returned to it
     *      recipient_ address who receives the Collateral Token
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     * @return qACtotalNeeded amount of AC used to mint qTC
     * @return qFeeTokenTotalNeeded amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */

    function _mintTCto(
        MintTCParams memory params_
    ) internal notLiquidated notPaused returns (uint256 qACtotalNeeded, uint256 qFeeTokenTotalNeeded) {
        uint256[] memory pACtps = _getPACtps();
        // evaluates whether or not the system coverage is healthy enough to mint TC, reverts if it's not
        (uint256 lckAC, uint256 nACgain) = _evalCoverage(protThrld, pACtps);
        // calculates how many qAC are needed to mint TC
        // [N] = [N] * [PREC] / [PREC]
        uint256 qACNeededToMint = _mulPrec(params_.qTC, _getPTCac(lckAC, nACgain));
        FeeCalcs memory feeCalcs;
        uint256 qACSurcharges;
        (qACSurcharges, qFeeTokenTotalNeeded, feeCalcs) = _calcFees(
            params_.sender,
            params_.vendor,
            qACNeededToMint,
            tcMintFee
        );
        qACtotalNeeded = qACNeededToMint + qACSurcharges;
        if (qACtotalNeeded > params_.qACmax) revert InsufficientQacSent(params_.qACmax, qACtotalNeeded);
        // if is 0 reverts because it is trying to redeem an amount below precision
        if (qACtotalNeeded == 0) revert QacNeededMustBeGreaterThanZero();
        emit TCMinted(
            params_.sender,
            params_.recipient,
            params_.qTC,
            qACtotalNeeded,
            feeCalcs.qACFee,
            feeCalcs.qFeeToken,
            feeCalcs.qACVendorMarkup,
            feeCalcs.qFeeTokenVendorMarkup
        );
        _depositAndMintTC(params_.qTC, qACNeededToMint, params_.recipient);
        uint256 acChange = _onACNeededOperation(params_.qACmax, qACtotalNeeded);
        // transfers any AC change to the sender and distributes fees
        _distOpResults(params_.sender, params_.sender, acChange, params_.vendor, feeCalcs);
    }

    struct RedeemTCParams {
        uint256 qTC;
        uint256 qACmin;
        address sender;
        address recipient;
        address vendor;
    }

    /**
     * @notice redeem Collateral Asset in exchange for Collateral Token
     * @param params_ redeemTCto function params
     * @dev
     *      qTC_ amount of Collateral Token to redeem
     *      qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     *      sender_ address who sends the Collateral Token
     *      recipient_ address who receives the Collateral Asset
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     * @return qACtoRedeem amount of AC sent to `recipient_`
     * @return qFeeTokenTotalNeeded amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */

    function _redeemTCto(
        RedeemTCParams memory params_
    ) internal notLiquidated notPaused returns (uint256 qACtoRedeem, uint256 qFeeTokenTotalNeeded) {
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
        FeeCalcs memory feeCalcs;
        uint256 qACSurcharges;
        (qACSurcharges, qFeeTokenTotalNeeded, feeCalcs) = _calcFees(
            params_.sender,
            params_.vendor,
            qACtotalToRedeem,
            tcRedeemFee
        );
        qACtoRedeem = qACtotalToRedeem - qACSurcharges;
        if (qACtoRedeem < params_.qACmin) revert QacBelowMinimumRequired(params_.qACmin, qACtoRedeem);
        emit TCRedeemed(
            params_.sender,
            params_.recipient,
            params_.qTC,
            qACtoRedeem,
            feeCalcs.qACFee,
            feeCalcs.qFeeToken,
            feeCalcs.qACVendorMarkup,
            feeCalcs.qFeeTokenVendorMarkup
        );
        _withdrawAndBurnTC(params_.qTC, qACtotalToRedeem, params_.sender);
        // transfers qAC to the recipient and distributes fees
        _distOpResults(params_.sender, params_.recipient, qACtoRedeem, params_.vendor, feeCalcs);
    }

    struct MintTPParams {
        uint256 i;
        uint256 qTP;
        uint256 qACmax;
        address sender;
        address recipient;
        address vendor;
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
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     * @return qACtotalNeeded amount of AC used to mint qTP
     * @return qFeeTokenTotalNeeded amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */
    function _mintTPto(
        MintTPParams memory params_
    ) internal notLiquidated notPaused returns (uint256 qACtotalNeeded, uint256 qFeeTokenTotalNeeded) {
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
        FeeCalcs memory feeCalcs;
        uint256 qACSurcharges;
        (qACSurcharges, qFeeTokenTotalNeeded, feeCalcs) = _calcFees(
            params_.sender,
            params_.vendor,
            qACNeededtoMint,
            tpMintFee[params_.i]
        );
        qACtotalNeeded = qACNeededtoMint + qACSurcharges;
        if (qACtotalNeeded > params_.qACmax) revert InsufficientQacSent(params_.qACmax, qACtotalNeeded);
        // if is 0 reverts because it is trying to mint an amount below precision
        if (qACtotalNeeded == 0) revert QacNeededMustBeGreaterThanZero();
        emit TPMinted(
            params_.i,
            params_.sender,
            params_.recipient,
            params_.qTP,
            qACtotalNeeded,
            feeCalcs.qACFee,
            feeCalcs.qFeeToken,
            feeCalcs.qACVendorMarkup,
            feeCalcs.qFeeTokenVendorMarkup
        );
        // update bucket and mint
        _depositAndMintTP(params_.i, params_.qTP, qACNeededtoMint, params_.recipient);
        uint256 acChange = _onACNeededOperation(params_.qACmax, qACtotalNeeded);
        // transfers any AC change to the sender and distributes fees
        _distOpResults(params_.sender, params_.sender, acChange, params_.vendor, feeCalcs);
    }

    struct RedeemTPParams {
        uint256 i;
        uint256 qTP;
        uint256 qACmin;
        address sender;
        address recipient;
        address vendor;
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
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     * @return qACtoRedeem amount of AC sent to `recipient_`
     * @return qFeeTokenTotalNeeded amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */
    function _redeemTPto(
        RedeemTPParams memory params_
    ) internal notLiquidated notPaused returns (uint256 qACtoRedeem, uint256 qFeeTokenTotalNeeded) {
        uint256[] memory pACtps = _getPACtps();
        uint256 pACtp = pACtps[params_.i];
        _updateTPtracking(params_.i, pACtp);
        // evaluates whether or not the system coverage is healthy enough to redeem TP, reverts if it's not
        _evalCoverage(protThrld, pACtps);
        // calculate how many total qAC are redeemed
        // [N] = [N] * [PREC] / [PREC]
        uint256 qACtotalToRedeem = _divPrec(params_.qTP, pACtp);
        FeeCalcs memory feeCalcs;
        uint256 qACSurcharges;
        (qACSurcharges, qFeeTokenTotalNeeded, feeCalcs) = _calcFees(
            params_.sender,
            params_.vendor,
            qACtotalToRedeem,
            tpRedeemFee[params_.i]
        );
        qACtoRedeem = qACtotalToRedeem - qACSurcharges;
        // if is 0 reverts because it is trying to redeem an amount below precision
        if (qACtotalToRedeem == 0) revert QacNeededMustBeGreaterThanZero();
        if (qACtoRedeem < params_.qACmin) revert QacBelowMinimumRequired(params_.qACmin, qACtoRedeem);
        emit TPRedeemed(
            params_.i,
            params_.sender,
            params_.recipient,
            params_.qTP,
            qACtoRedeem,
            feeCalcs.qACFee,
            feeCalcs.qFeeToken,
            feeCalcs.qACVendorMarkup,
            feeCalcs.qFeeTokenVendorMarkup
        );
        _withdrawAndBurnTP(params_.i, params_.qTP, qACtotalToRedeem, params_.sender);
        // transfers qAC to the recipient and distributes fees
        _distOpResults(params_.sender, params_.recipient, qACtoRedeem, params_.vendor, feeCalcs);
    }

    struct MintTCandTPParams {
        uint256 i;
        uint256 qTP;
        uint256 qACmax;
        address sender;
        address recipient;
        address vendor;
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
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     * @return qACtotalNeeded amount of AC used to mint Collateral Token and Pegged Token
     * @return qTCtoMint amount of Collateral Token minted
     * @return qFeeTokenTotalNeeded amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */
    function _mintTCandTPto(
        MintTCandTPParams memory params_
    )
        internal
        notLiquidated
        notPaused
        returns (uint256 qACtotalNeeded, uint256 qTCtoMint, uint256 qFeeTokenTotalNeeded)
    {
        uint256 qACNeededtoMint;
        (uint256 ctargemaCA, uint256[] memory pACtps) = _updateEmasAndCalcCtargemaCA();
        uint256 pACtp = pACtps[params_.i];
        _updateTPtracking(params_.i, pACtp);
        // evaluates that the system is not below the liquidation threshold
        // one of the reasons is to prevent it from failing due to underflow because the lckAC > totalACavailable
        _evalCoverage(liqThrld, pACtps);
        (qTCtoMint, qACNeededtoMint) = _calcQACforMintTCandTP(params_.qTP, pACtp, ctargemaCA, pACtps);
        FeeCalcs memory feeCalcs;
        uint256 qACSurcharges;
        (qACSurcharges, qFeeTokenTotalNeeded, feeCalcs) = _calcFees(
            params_.sender,
            params_.vendor,
            qACNeededtoMint,
            mintTCandTPFee
        );
        qACtotalNeeded = qACNeededtoMint + qACSurcharges;
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
            feeCalcs.qACFee,
            feeCalcs.qFeeToken,
            feeCalcs.qACVendorMarkup,
            feeCalcs.qFeeTokenVendorMarkup
        );
        _depositAndMintTC(qTCtoMint, qACNeededtoMint, params_.recipient);
        _depositAndMintTP(params_.i, params_.qTP, 0, params_.recipient);
        uint256 acChange = _onACNeededOperation(params_.qACmax, qACtotalNeeded);
        // transfers qAC to the sender and distributes fees
        _distOpResults(params_.sender, params_.sender, acChange, params_.vendor, feeCalcs);
    }

    struct RedeemTCandTPParams {
        uint256 i;
        uint256 qTC;
        uint256 qTP;
        uint256 qACmin;
        address sender;
        address recipient;
        address vendor;
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
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     * @return qACtoRedeem amount of AC sent to `recipient_`
     * @return qTPtoRedeem amount of Pegged Token redeemed
     * @return qFeeTokenTotalNeeded amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */
    function _redeemTCandTPto(
        RedeemTCandTPParams memory params_
    )
        internal
        notLiquidated
        notPaused
        returns (uint256 qACtoRedeem, uint256 qTPtoRedeem, uint256 qFeeTokenTotalNeeded)
    {
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
        FeeCalcs memory feeCalcs;
        uint256 qACSurcharges;
        (qACSurcharges, qFeeTokenTotalNeeded, feeCalcs) = _calcFees(
            params_.sender,
            params_.vendor,
            qACtotalToRedeem,
            redeemTCandTPFee
        );
        qACtoRedeem = qACtotalToRedeem - qACSurcharges;
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
            feeCalcs.qACFee,
            feeCalcs.qFeeToken,
            feeCalcs.qACVendorMarkup,
            feeCalcs.qFeeTokenVendorMarkup
        );

        _withdrawAndBurnTC(params_.qTC, qACtotalToRedeem, params_.sender);
        _withdrawAndBurnTP(params_.i, qTPtoRedeem, 0, params_.sender);

        // transfers qAC to the recipient and distributes fees
        _distOpResults(params_.sender, params_.recipient, qACtoRedeem, params_.vendor, feeCalcs);
    }

    struct SwapTPforTCParams {
        uint256 i;
        uint256 qTP;
        uint256 qTCmin;
        uint256 qACmax;
        address sender;
        address recipient;
        address vendor;
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
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     * @return qACSurcharges amount of AC used to pay fees and markup
     * @return qTPtoMint amount of Pegged Token minted
     * @return qFeeTokenTotalNeeded amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */
    function _swapTPforTPto(
        SwapTPforTPParams memory params_
    )
        internal
        notLiquidated
        notPaused
        returns (uint256 qACSurcharges, uint256 qTPtoMint, uint256 qFeeTokenTotalNeeded)
    {
        FeeCalcs memory feeCalcs;
        bytes memory payload = abi.encodeCall(MocCoreExpansion(mocCoreExpansion).swapTPforTPto, (params_));
        (qACSurcharges, qTPtoMint, qFeeTokenTotalNeeded, feeCalcs) = abi.decode(
            Address.functionDelegateCall(mocCoreExpansion, payload),
            (uint256, uint256, uint256, FeeCalcs)
        );

        // AC is only used to pay fees and markup
        uint256 acChange = _onACNeededOperation(params_.qACmax, qACSurcharges);
        // transfer any qAC change to the sender and distribute fees
        _distOpResults(params_.sender, params_.sender, acChange, params_.vendor, feeCalcs);
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
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     * @return qACSurcharges amount of AC used to pay fees and markup
     * @return qTCtoMint amount of Collateral Token minted
     * @return qFeeTokenTotalNeeded amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */
    function _swapTPforTCto(
        SwapTPforTCParams memory params_
    )
        internal
        notLiquidated
        notPaused
        returns (uint256 qACSurcharges, uint256 qTCtoMint, uint256 qFeeTokenTotalNeeded)
    {
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

        FeeCalcs memory feeCalcs;
        (qACSurcharges, qFeeTokenTotalNeeded, feeCalcs) = _calcFees(
            params_.sender,
            params_.vendor,
            qACtotalToRedeem,
            swapTPforTCFee
        );
        if (qACSurcharges > params_.qACmax) revert InsufficientQacSent(params_.qACmax, feeCalcs.qACFee);
        emit TPSwappedForTC(
            params_.i,
            params_.sender,
            params_.recipient,
            params_.qTP,
            qTCtoMint,
            feeCalcs.qACFee,
            feeCalcs.qFeeToken,
            feeCalcs.qACVendorMarkup,
            feeCalcs.qFeeTokenVendorMarkup
        );

        _withdrawAndBurnTP(params_.i, params_.qTP, 0, params_.sender);
        _depositAndMintTC(qTCtoMint, 0, params_.recipient);

        // AC is only used to pay fees and markup
        uint256 acChange = _onACNeededOperation(params_.qACmax, qACSurcharges);
        // transfer any qAC change to the sender and distribute fees
        _distOpResults(params_.sender, params_.sender, acChange, params_.vendor, feeCalcs);
    }

    struct SwapTCforTPParams {
        uint256 i;
        uint256 qTC;
        uint256 qTPmin;
        uint256 qACmax;
        address sender;
        address recipient;
        address vendor;
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
     *      vendor_ address who receives a markup. If its address(0) no markup is applied
     * @return qACSurcharges amount of AC used to pay fees and markup
     * @return qTPtoMint amount of Pegged Token minted
     * @return qFeeTokenTotalNeeded amount of Fee Token used by `sender_` to pay fees. 0 if qAC is used instead
     */
    function _swapTCforTPto(
        SwapTCforTPParams memory params_
    )
        internal
        notLiquidated
        notPaused
        returns (uint256 qACSurcharges, uint256 qTPtoMint, uint256 qFeeTokenTotalNeeded)
    {
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

        FeeCalcs memory feeCalcs;
        (qACSurcharges, qFeeTokenTotalNeeded, feeCalcs) = _calcFees(
            params_.sender,
            params_.vendor,
            qACtotalToRedeem,
            swapTCforTPFee
        );
        if (qACSurcharges > params_.qACmax) revert InsufficientQacSent(params_.qACmax, feeCalcs.qACFee);
        emit TCSwappedForTP(
            params_.i,
            params_.sender,
            params_.recipient,
            params_.qTC,
            qTPtoMint,
            feeCalcs.qACFee,
            feeCalcs.qFeeToken,
            feeCalcs.qACVendorMarkup,
            feeCalcs.qFeeTokenVendorMarkup
        );

        _withdrawAndBurnTC(params_.qTC, 0, params_.sender);
        _depositAndMintTP(params_.i, qTPtoMint, 0, params_.recipient);

        // AC is only used to pay fees and markup
        uint256 acChange = _onACNeededOperation(params_.qACmax, qACSurcharges);
        // transfer any qAC change to the sender and distribute fees
        _distOpResults(params_.sender, params_.sender, acChange, params_.vendor, feeCalcs);
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
     * @param sender_ address who executes the operation
     * @param operatorsAddress_ operator's address to receive `operatorsQAC_`
     * @param operatorsQAC_ amount of AC to transfer operator [N]
     * @param vendor_ vendors address to pay markup to
     * @param feeCalcs_ struct with:
     * @dev
     *      qACFee amount of AC needed to pay fees
     *      qFeeToken amount of Fee Token needed to pay fess
     *      qACVendorMarkup amount of AC needed to pay vendor markup
     *      qFeeTokenVendorMarkup amount of Fee Token needed to pay vendor markup
     */
    function _distOpResults(
        address sender_,
        address operatorsAddress_,
        uint256 operatorsQAC_,
        address vendor_,
        FeeCalcs memory feeCalcs_
    ) internal {
        if (feeCalcs_.qACFee > 0) {
            // [N] = [PREC] * [N] / [PREC]
            uint256 qACFeeRetained = _mulPrec(feeRetainer, feeCalcs_.qACFee);
            // Increase collateral in the retain amount
            nACcb += qACFeeRetained;
            // transfer qAC fee to Moc Fee Flow
            acTransfer(mocFeeFlowAddress, feeCalcs_.qACFee - qACFeeRetained);
            // transfer qAC markup to vendor
            acTransfer(vendor_, feeCalcs_.qACVendorMarkup);
        }
        // if qACFee == 0 then the fees are paid in Fee Token
        else {
            // transfer Fee Token to Moc Fee Flow
            _feeTokenTransfer(sender_, mocFeeFlowAddress, feeCalcs_.qFeeToken);
            // transfer Fee Token to vendor
            _feeTokenTransfer(sender_, vendor_, feeCalcs_.qFeeTokenVendorMarkup);
        }
        // transfer qAC to operator
        acTransfer(operatorsAddress_, operatorsQAC_);
    }

    /**
     * @notice transfer Fee Tokens from an address to another
     * @dev this function could revert during safeTransfer call.
     *  safeTransfer will revert if token transfer reverts or returns 0
     * @param from_ address who sends the Fee Token
     * @param to_ address who receives the Fee Token
     * @param amount_ amount of Fee Token to transfer
     */
    function _feeTokenTransfer(address from_, address to_, uint256 amount_) internal {
        if (amount_ > 0) SafeERC20.safeTransferFrom(feeToken, from_, to_, amount_);
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
            recipient: msg.sender,
            vendor: address(0)
        });
        return _redeemTCto(params);
    }

    /**
     * @notice caller sends Collateral Token and receives Collateral Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @param vendor_ address who receives a markup
     * @return qACRedeemed amount of AC sent to sender
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTCViaVendor(
        uint256 qTC_,
        uint256 qACmin_,
        address vendor_
    ) external returns (uint256 qACRedeemed, uint256 qFeeToken) {
        RedeemTCParams memory params = RedeemTCParams({
            qTC: qTC_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
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
            recipient: recipient_,
            vendor: address(0)
        });
        return _redeemTCto(params);
    }

    /**
     * @notice caller sends Collateral Token and recipient receives Collateral Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param qTC_ amount of Collateral Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @param vendor_ address who receives a markup
     * @return qACRedeemed amount of AC sent to 'recipient_'
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTCtoViaVendor(
        uint256 qTC_,
        uint256 qACmin_,
        address recipient_,
        address vendor_
    ) external returns (uint256 qACRedeemed, uint256 qFeeToken) {
        RedeemTCParams memory params = RedeemTCParams({
            qTC: qTC_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
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
            recipient: msg.sender,
            vendor: address(0)
        });
        return _redeemTPto(params);
    }

    /**
     * @notice caller sends Pegged Token and receives Collateral Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param i_ Pegged Token index to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that sender expects to receive
     * @param vendor_ address who receives a markup
     * @return qACRedeemed amount of AC sent to sender
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTPViaVendor(
        uint256 i_,
        uint256 qTP_,
        uint256 qACmin_,
        address vendor_
    ) external returns (uint256 qACRedeemed, uint256 qFeeToken) {
        RedeemTPParams memory params = RedeemTPParams({
            i: i_,
            qTP: qTP_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
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
            recipient: recipient_,
            vendor: address(0)
        });
        return _redeemTPto(params);
    }

    /**
     * @notice caller sends Pegged Token and recipient receives Collateral Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     * @param i_ Pegged Token index to redeem
     * @param qTP_ amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @param vendor_ address who receives a markup
     * @return qACRedeemed amount of AC sent to 'recipient_'
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTPtoViaVendor(
        uint256 i_,
        uint256 qTP_,
        uint256 qACmin_,
        address recipient_,
        address vendor_
    ) external returns (uint256 qACRedeemed, uint256 qFeeToken) {
        RedeemTPParams memory params = RedeemTPParams({
            i: i_,
            qTP: qTP_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
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
            recipient: msg.sender,
            vendor: address(0)
        });
        return _redeemTCandTPto(params);
    }

    /**
     * @notice caller sends Collateral Token and Pegged Token and receives coinbase as Collateral Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param i_ Pegged Token index
     * @param qTC_ maximum amount of Collateral Token to redeem
     * @param qTP_ maximum amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that the sender expects to receive
     * @param vendor_ address who receives a markup
     * @return qACRedeemed amount of AC sent to the sender
     * @return qTPRedeemed amount of Pegged Token redeemed
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTCandTPViaVendor(
        uint256 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACmin_,
        address vendor_
    ) external returns (uint256 qACRedeemed, uint256 qTPRedeemed, uint256 qFeeToken) {
        RedeemTCandTPParams memory params = RedeemTCandTPParams({
            i: i_,
            qTC: qTC_,
            qTP: qTP_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: msg.sender,
            vendor: vendor_
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
            recipient: recipient_,
            vendor: address(0)
        });
        return _redeemTCandTPto(params);
    }

    /**
     * @notice caller sends Collateral Token and Pegged Token and recipient receives Collateral Asset
     *  `vendor_` receives a markup in Fee Token if possible or in qAC if not
     *  This operation is done without checking coverage
     *  Collateral Token and Pegged Token are redeemed in equivalent proportions so that its price
     *  and global coverage are not modified.
     *  Reverts if qTP sent are insufficient.
     * @param i_ Pegged Token index
     * @param qTC_ maximum amount of Collateral Token to redeem
     * @param qTP_ maximum amount of Pegged Token to redeem
     * @param qACmin_ minimum amount of Collateral Asset that `recipient_` expects to receive
     * @param recipient_ address who receives the Collateral Asset
     * @param vendor_ address who receives a markup
     * @return qACRedeemed amount of AC sent to the `recipient_`
     * @return qTPRedeemed amount of Pegged Token redeemed
     * @return qFeeToken amount of Fee Token used by sender to pay fees. 0 if qAC is used instead
     */
    function redeemTCandTPtoViaVendor(
        uint256 i_,
        uint256 qTC_,
        uint256 qTP_,
        uint256 qACmin_,
        address recipient_,
        address vendor_
    ) external returns (uint256 qACRedeemed, uint256 qTPRedeemed, uint256 qFeeToken) {
        RedeemTCandTPParams memory params = RedeemTCandTPParams({
            i: i_,
            qTC: qTC_,
            qTP: qTP_,
            qACmin: qACmin_,
            sender: msg.sender,
            recipient: recipient_,
            vendor: vendor_
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
