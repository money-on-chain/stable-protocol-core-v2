pragma solidity ^0.8.17;

import "../interfaces/IMocRC20.sol";
import "../tokens/MocTC.sol";
import "../interfaces/IPriceProvider.sol";
import "../governance/MocUpgradable.sol";
import "../MocSettlement.sol";

/**
 * @title MocBaseBucket: Moc Collateral Bag
 * @notice MocBaseBucket holds Bucket Zero state, both for the Collateral Bag and PeggedTokens Items.
 * @dev Abstracts all rw operations on the main bucket and expose all calculations relative to its state.
 */
abstract contract MocBaseBucket is MocUpgradable {
    // ------- Events -------
    event ContractLiquidated();

    // ------- Custom Errors -------
    error InvalidPriceProvider(address priceProviderAddress_);
    error TransferFailed();
    error Liquidated();
    error OnlyWhenLiquidated();
    error LowCoverage(uint256 cglb_, uint256 covThrld_);
    error OnlySettlement();

    // ------- Structs -------
    struct PegContainerItem {
        // total supply of Pegged Token
        uint256 nTP;
        // PegToken PriceFeed address
        IPriceProvider priceProvider;
    }

    struct PeggedTokenIndex {
        // Pegged Token index
        uint8 index;
        // true if Pegged Token exists
        bool exists;
    }

    struct InitializeBaseBucketParams {
        // Collateral Token contract address
        address tcTokenAddress;
        // MocSettlement contract address
        address mocSettlementAddress;
        // Moc Fee Flow contract address
        address mocFeeFlowAddress;
        // moc appreciation beneficiary Address
        address mocAppreciationBeneficiaryAddress;
        // protected state threshold [PREC]
        uint256 protThrld;
        // liquidation coverage threshold [PREC]
        uint256 liqThrld;
        // pct retain on fees to be re-injected as Collateral, while paying fees with AC [PREC]
        uint256 feeRetainer;
        // additional fee pct applied on mint Collateral Tokens operations [PREC]
        uint256 tcMintFee;
        // additional fee pct applied on redeem Collateral Tokens operations [PREC]
        uint256 tcRedeemFee;
        // additional fee pct applied on swap a Pegged Token for another Pegged Token [PREC]
        uint256 swapTPforTPFee;
        // additional fee pct applied on swap a Pegged Token for Collateral Token [PREC]
        uint256 swapTPforTCFee;
        // additional fee pct applied on swap Collateral Token for a Pegged Token [PREC]
        uint256 swapTCforTPFee;
        // additional fee pct applied on redeem Collateral Token and Pegged Token in one operations [PREC]
        uint256 redeemTCandTPFee;
        // additional fee pct applied on mint Collateral Token and Pegged Token in one operation [PREC]
        uint256 mintTCandTPFee;
        // pct of the gain because Pegged Tokens devaluation that is transferred
        // in Collateral Asset to Moc Fee Flow during the settlement [PREC]
        uint256 successFee;
        // pct of the gain because Pegged Tokens devaluation that is returned
        // in Pegged Tokens to appreciation beneficiary during the settlement [PREC]
        uint256 appreciationFactor;
    }

    // ------- Storage -------

    // total amount of Collateral Asset held in the Collateral Bag
    uint256 public nACcb;
    // amount of Collateral Asset that the Vaults owe to the Collateral Bag
    uint256 internal nACioucb;

    // Collateral Token
    MocTC public tcToken;
    // Collateral Token in the Collateral Bag
    uint256 public nTCcb;

    // Pegged Tokens MocRC20 addresses
    IMocRC20[] public tpTokens;
    // Pegged Token indexes
    mapping(address => PeggedTokenIndex) public peggedTokenIndex;
    // peg container
    PegContainerItem[] public pegContainer;
    // Pegged Token prices, at which they can be redeemed after liquidation event
    uint256[] internal tpLiqPrices;
    // pct of the gain because Pegged Tokens devaluation that is transferred
    // in Collateral Asset to Moc Fee Flow during the settlement [PREC]
    uint256 public successFee;
    // pct of the gain because Pegged Tokens devaluation that is returned
    // in Pegged Tokens to appreciation beneficiary during the settlement [PREC]
    uint256 public appreciationFactor;

    // ------- Storage Fees -------

    // pct retain on fees to be re-injected as Collateral, while paying fees with AC [PREC]
    uint256 public feeRetainer; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // addition fee pct applied on Collateral Tokens mint [PREC]
    uint256 public tcMintFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // addition fee pct applied on Collateral Tokens redeem [PREC]
    uint256 public tcRedeemFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // additional fee pct applied on swap a Pegged Token for another Pegged Token [PREC]
    uint256 public swapTPforTPFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // additional fee pct applied on swap a Pegged Token for Collateral Token [PREC]
    uint256 public swapTPforTCFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // additional fee pct applied on swap Collateral Token for a Pegged Token [PREC]
    uint256 public swapTCforTPFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // additional fee pct applied on redeem Collateral Token and Pegged Token in one operations [PREC]
    uint256 public redeemTCandTPFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // additional fee pct applied on mint Collateral Token and Pegged Token in one operation [PREC]
    uint256 public mintTCandTPFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    // addition fee pct applied on Pegged Tokens mint [PREC]
    uint256[] public tpMintFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // addition fee pct applied on Pegged Tokens redeem [PREC]
    uint256[] public tpRedeemFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    // Moc Fee Flow contract address
    address public mocFeeFlowAddress;
    // Moc appreciation beneficiary address
    address public mocAppreciationBeneficiaryAddress;
    // MocSettlement contract
    MocSettlement public mocSettlement;

    // ------- Storage Coverage Tracking -------

    // Target coverage for each Pegged Token [PREC]
    uint256[] public tpCtarg;
    // Coverage protected state threshold [PREC]
    uint256 public protThrld;
    // Coverage liquidation threshold [PREC]
    uint256 public liqThrld;
    // Liquidation enabled
    bool public liqEnabled;
    // Irreversible state, peg lost, contract is terminated and all funds can be withdrawn
    bool public liquidated;

    // ------- Storage Success Fee Tracking -------

    // profit and loss in collateral asset for each Pegged Token because its devaluation [N]
    // if it is positive it is a profit that will be distributed and reset during settlement
    int256[] internal tpiou;
    // Pegged Token price used at last operation(redeem or mint) [PREC]
    uint256[] internal pACtpLstop;

    // ------- Modifiers -------
    /// @notice functions with this modifier reverts being in liquidated state
    modifier notLiquidated() {
        _checkLiquidated();
        _;
    }

    /// @notice functions with this modifier only can be called by settlement contract
    modifier onlySettlement() {
        if (msg.sender != address(mocSettlement)) revert OnlySettlement();
        _;
    }

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param initializeBaseBucketParams_ contract initializer params
     * @dev   tcTokenAddress Collateral Token contract address
     *        mocSettlementAddress MocSettlement contract address
     *        mocFeeFlowAddress Moc Fee Flow contract address
     *        mocAppreciationBeneficiaryAddress Moc appreciation beneficiary address
     *        protThrld protected coverage threshold [PREC]
     *        liqThrld liquidation coverage threshold [PREC]
     *        feeRetainer pct retain on fees to be re-injected as Collateral, while paying fees with AC [PREC]
     *        tcMintFee additional fee pct applied on mint Collateral Tokens operations [PREC]
     *        tcRedeemFee additional fee pct applied on redeem Collateral Tokens operations [PREC]
     *        swapTPforTPFee additional fee pct applied on swap a Pegged Token for another Pegged Token [PREC]
     *        swapTPforTCFee additional fee pct applied on swap a Pegged Token for Collateral Token [PREC]
     *        swapTCforTPFee additional fee pct applied on swap Collateral Token for a Pegged Token [PREC]
     *        redeemTCandTPFee additional fee pct applied on redeem Collateral Token and Pegged Token [PREC]
     *        mintTCandTPFee additional fee pct applied on mint Collateral Token and Pegged Token [PREC]
     *        successFee pct of the gain because Pegged Tokens devaluation that is transferred
     *          in Collateral Asset to Moc Fee Flow during the settlement [PREC]
     *        appreciationFactor pct of the gain because Pegged Tokens devaluation that is returned
     *          in Pegged Tokens to appreciation beneficiary during the settlement [PREC]
     */
    function __MocBaseBucket_init_unchained(
        InitializeBaseBucketParams calldata initializeBaseBucketParams_
    ) internal onlyInitializing {
        if (initializeBaseBucketParams_.protThrld < ONE) revert InvalidValue();
        _checkLessThanOne(initializeBaseBucketParams_.feeRetainer);
        _checkLessThanOne(initializeBaseBucketParams_.tcMintFee);
        _checkLessThanOne(initializeBaseBucketParams_.tcRedeemFee);
        _checkLessThanOne(initializeBaseBucketParams_.swapTPforTPFee);
        _checkLessThanOne(initializeBaseBucketParams_.swapTPforTCFee);
        _checkLessThanOne(initializeBaseBucketParams_.swapTCforTPFee);
        _checkLessThanOne(initializeBaseBucketParams_.redeemTCandTPFee);
        _checkLessThanOne(initializeBaseBucketParams_.mintTCandTPFee);
        _checkLessThanOne(initializeBaseBucketParams_.successFee + initializeBaseBucketParams_.appreciationFactor);
        tcToken = MocTC(initializeBaseBucketParams_.tcTokenAddress);
        // Verifies it has the right roles over this TC
        if (!tcToken.hasFullRoles(address(this))) revert InvalidAddress();
        mocFeeFlowAddress = initializeBaseBucketParams_.mocFeeFlowAddress;
        mocAppreciationBeneficiaryAddress = initializeBaseBucketParams_.mocAppreciationBeneficiaryAddress;
        mocSettlement = MocSettlement(initializeBaseBucketParams_.mocSettlementAddress);
        protThrld = initializeBaseBucketParams_.protThrld;
        liqThrld = initializeBaseBucketParams_.liqThrld;
        feeRetainer = initializeBaseBucketParams_.feeRetainer;
        tcMintFee = initializeBaseBucketParams_.tcMintFee;
        tcRedeemFee = initializeBaseBucketParams_.tcRedeemFee;
        swapTPforTPFee = initializeBaseBucketParams_.swapTPforTPFee;
        swapTPforTCFee = initializeBaseBucketParams_.swapTPforTCFee;
        swapTCforTPFee = initializeBaseBucketParams_.swapTCforTPFee;
        redeemTCandTPFee = initializeBaseBucketParams_.redeemTCandTPFee;
        mintTCandTPFee = initializeBaseBucketParams_.mintTCandTPFee;
        successFee = initializeBaseBucketParams_.successFee;
        appreciationFactor = initializeBaseBucketParams_.appreciationFactor;
        liquidated = false;
        liqEnabled = false;
    }

    // ------- Internal Functions -------

    /**
     * reverts if in liquidated state
     */
    function _checkLiquidated() internal view {
        if (liquidated) revert Liquidated();
    }

    /**
     * @notice Adds Collateral Token and Collateral Asset to the Bucket
     * @param qTC_ amount of Collateral Token to add
     * @param qAC_ amount of Collateral Asset to add
     */
    function _depositTC(uint256 qTC_, uint256 qAC_) internal {
        nTCcb += qTC_;
        nACcb += qAC_;
    }

    /**
     * @notice Subtracts Collateral Token and Collateral Asset from the Bucket
     * @param qTC_ amount of Collateral Token to subtract
     * @param qAC_ amount of Collateral Asset to subtract
     */
    function _withdrawTC(uint256 qTC_, uint256 qAC_) internal {
        nTCcb -= qTC_;
        nACcb -= qAC_;
    }

    /**
     * @notice Adds Pegged Token and Collateral Asset to the Bucket
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to add
     * @param qAC_ amount of Collateral Asset to add
     */
    function _depositTP(uint8 i_, uint256 qTP_, uint256 qAC_) internal {
        pegContainer[i_].nTP += qTP_;
        nACcb += qAC_;
    }

    /**
     * @notice Subtracts Pegged Token and Collateral Asset from the Bucket
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to subtract
     * @param qAC_ amount of Collateral Asset to subtract
     */
    function _withdrawTP(uint8 i_, uint256 qTP_, uint256 qAC_) internal {
        pegContainer[i_].nTP -= qTP_;
        nACcb -= qAC_;
    }

    /**
     * @notice Adds Pegged Token and Collateral Asset to the Bucket and mints `qTP_` for Pegged Token `i_`
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to add
     * @param qAC_ amount of Collateral Asset to add
     * @param recipient_ the account to mint tokens to
     */
    function _depositAndMintTP(uint8 i_, uint256 qTP_, uint256 qAC_, address recipient_) internal {
        // add qTP and qAC to the Bucket
        _depositTP(i_, qTP_, qAC_);
        // mint qTP to the recipient
        tpTokens[i_].mint(recipient_, qTP_);
    }

    /**
     * @notice subtracts Pegged Token and Collateral Asset from the Bucket and burns `qTP_` for Pegged Token `i_`
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to subtract
     * @param qAC_ amount of Collateral Asset to subtract
     * @param toBurnFrom_ the account to burn tokens from
     */
    function _withdrawAndBurnTP(uint8 i_, uint256 qTP_, uint256 qAC_, address toBurnFrom_) internal {
        // sub qTP and qAC from the Bucket
        _withdrawTP(i_, qTP_, qAC_);
        // burn qTP from this address
        tpTokens[i_].burn(toBurnFrom_, qTP_);
    }

    /**
     * @notice Adds Collateral Token and Collateral Asset to the Bucket and mints qTCtoMint
     * @param qTC_ amount of Collateral Token to add
     * @param qAC_ amount of Collateral Asset to add
     * @param recipient_ the account to mint tokens to
     */
    function _depositAndMintTC(uint256 qTC_, uint256 qAC_, address recipient_) internal {
        // add qTC to the Bucket
        _depositTC(qTC_, qAC_);
        // mint qTC to the recipient
        tcToken.mint(recipient_, qTC_);
    }

    /**
     * @notice Subtracts Collateral Token and Collateral Asset from the Bucket and burns `qTC_`
     * @param qTC_ amount of Collateral Token to subtract
     * @param qAC_ amount of Collateral Asset to subtract
     * @param toBurnFrom_ the account to burn tokens from
     */
    function _withdrawAndBurnTC(uint256 qTC_, uint256 qAC_, address toBurnFrom_) internal {
        // sub qTC and qAC from the Bucket
        _withdrawTC(qTC_, qAC_);
        // burn qTC from this address
        tcToken.burn(toBurnFrom_, qTC_);
    }

    /**
     * @notice get amount of Collateral Asset locked by Pegged Token adjusted by EMA
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return lckACemaAdjusted [PREC]
     */
    function _getLckACemaAdjusted(
        uint256 ctargemaCA_,
        uint256 lckAC_,
        uint256 nACgain_
    ) internal view returns (uint256 lckACemaAdjusted) {
        // [PREC] = [N] * [PREC] - [PREC] * [N]
        return _getTotalACavailable(nACgain_) * PRECISION - ctargemaCA_ * lckAC_;
    }

    /**
     * @notice get amount of Collateral Token available to redeem
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return tcAvailableToRedeem [N]
     */
    function _getTCAvailableToRedeem(
        uint256 ctargemaCA_,
        uint256 lckAC_,
        uint256 nACgain_
    ) internal view returns (uint256 tcAvailableToRedeem) {
        // [PREC]
        uint256 lckACemaAdjusted = _getLckACemaAdjusted(ctargemaCA_, lckAC_, nACgain_);
        // [N] = [PREC] / [PREC]
        return lckACemaAdjusted / _getPTCac(lckAC_, nACgain_);
    }

    /**
     * @notice get amount of Pegged Token available to mint
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset
     * @param ctargemaTP_ target coverage adjusted by the moving average of the value of a Pegged Token
     * @param pACtp_ Collateral Asset price in amount of Pegged Token [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return tpAvailableToMint [N]
     */
    function _getTPAvailableToMint(
        uint256 ctargemaCA_,
        uint256 ctargemaTP_,
        uint256 pACtp_,
        uint256 lckAC_,
        uint256 nACgain_
    ) internal view returns (uint256 tpAvailableToMint) {
        // [PREC]
        uint256 lckACemaAdjusted = _getLckACemaAdjusted(ctargemaCA_, lckAC_, nACgain_);
        // [PREC] = [PREC] * [PREC] / [PREC]
        uint256 pACtpEmaAdjusted = (ctargemaCA_ * pACtp_) / ctargemaTP_;
        // [PREC] = [PREC] * [PREC] / [PREC]
        uint256 num = _mulPrec(lckACemaAdjusted, pACtpEmaAdjusted);
        // [PREC] = [PREC] - [PREC]
        uint256 den = ctargemaCA_ - ONE;
        // [N] = [PREC] / [PREC]
        return num / den;
    }

    /**
     * @notice evaluates whether or not the coverage is over the cThrld_, reverts if below
     * @param cThrld_ coverage threshold to check for [PREC]
     * @return lckAC amount of Collateral Asset locked by Pegged Tokens [PREC]
     * @return nACgain amount of collateral asset to be distributed during settlement [N]
     */
    function _evalCoverage(uint256 cThrld_) internal view returns (uint256 lckAC, uint256 nACgain) {
        (lckAC, nACgain) = _getLckACandACgain();
        uint256 cglb = _getCglb(lckAC, nACgain);
        // check if coverage is above the given threshold
        if (cglb <= cThrld_) revert LowCoverage(cglb, cThrld_);
    }

    /**
     * @dev Calculates price at liquidation event as a relation between Pegs total supply
     * and the amount of Asset Collateral available to distribute
     */
    function settleLiquidationPrices() internal {
        // Total amount of AC available to be redeemed
        uint256 totalACAvailable = nACcb + nACioucb;
        if (totalACAvailable == 0) return;
        uint256 pegAmount = pegContainer.length;
        // this could be get by getLckAC(), but given the prices are needed after,
        // it's better to cache them here.
        uint256 lckAC;
        // Auxiliary cache of pegs pACtp
        uint256[] memory pACtps = new uint256[](pegAmount);
        // for each peg, calculates the proportion of AC reserves it's locked

        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            pACtps[i] = getPACtp(i);
            // [N] = [N] * [PREC] / [PREC]
            lckAC += _divPrec(pegContainer[i].nTP, pACtps[i]);
        }
        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            // [PREC] = [PREC] * [N] / [N];
            tpLiqPrices.push((pACtps[i] * lckAC) / totalACAvailable);
        }
    }

    /**
     * @notice updates Pegged Token P&L and last operation price
     * @param i_ Pegged Token index
     * @param pACtp_ Pegged Token price [PREC]
     */
    function _updateTPtracking(uint8 i_, uint256 pACtp_) internal {
        tpiou[i_] += _calcOtfPnLTP(i_, pACtp_);
        pACtpLstop[i_] = pACtp_;
    }

    /**
     * @notice calculates on the fly Pegged Token P&L
     * @param i_ Pegged Token index
     * @param pACtp_ Pegged Token price [PREC]
     * @return otfPnLtp [N]
     */
    function _calcOtfPnLTP(uint8 i_, uint256 pACtp_) internal view returns (int256 otfPnLtp) {
        // [PREC] = [N] * [PREC]
        uint256 nTP = pegContainer[i_].nTP * PRECISION;
        // [N] = [PREC] / [PREC] - [PREC] / [PREC]
        return int256(nTP / pACtpLstop[i_]) - int256(nTP / pACtp_);
    }

    /**
     * @notice gets accumulated Pegged Token P&L
     * @param i_ Pegged Token index
     * @param pACtp_ Pegged Token price [PREC]
     * @return tpGain amount of Pegged Token to be minted during settlement [N]
     * @return adjPnLtpi total amount of P&L in Collateral Asset [N]
     */
    function _getPnLTP(uint8 i_, uint256 pACtp_) internal view returns (uint256 tpGain, uint256 adjPnLtpi) {
        // [N] = [N] + [N]
        int256 adjPnLtpiAux = tpiou[i_] + _calcOtfPnLTP(i_, pACtp_);
        if (adjPnLtpiAux > 0) {
            adjPnLtpi = uint256(adjPnLtpiAux);
            // [N] = (([PREC] * [PREC] / [PREC]) * [N]) / [PREC]
            tpGain = _mulPrec(_mulPrec(appreciationFactor, pACtp_), adjPnLtpi);
        }
        return (tpGain, adjPnLtpi);
    }

    /**
     * @notice get amount of Collateral Asset locked by Pegged Token and
     *  amount of collateral asset to be distributed during settlement
     * @return lckAC [N]
     * @return nACgain [N]
     */
    function _getLckACandACgain() internal view returns (uint256 lckAC, uint256 nACgain) {
        uint256 pegAmount = pegContainer.length;
        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            uint256 pACtp = getPACtp(i);
            (uint256 tpGain, uint256 adjPnLtpi) = _getPnLTP(i, pACtp);
            // [N] = ([N] + [N]) * [PREC] / [PREC]
            lckAC += _divPrec(pegContainer[i].nTP + tpGain, pACtp);
            nACgain += adjPnLtpi;
        }
        // [N] = [N] * [PREC] / [PREC]
        nACgain = _mulPrec(nACgain, successFee);
        return (lckAC, nACgain);
    }

    /**
     * @notice get total Collateral Asset available
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return totalACavailable [N]
     */
    function _getTotalACavailable(uint256 nACgain_) internal view returns (uint256 totalACavailable) {
        // [N] = [N] + [N] - [N]
        return nACcb + nACioucb - nACgain_;
    }

    /**
     * @notice get Collateral Token price
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return pTCac [PREC]
     */
    function _getPTCac(uint256 lckAC_, uint256 nACgain_) internal view returns (uint256 pTCac) {
        if (nTCcb == 0) return ONE;
        // [PREC] = ([N] - [N]) * [PREC]) / [N]
        return _divPrec((_getTotalACavailable(nACgain_) - lckAC_), nTCcb);
    }

    /**
     * @notice get Collateral Token leverage
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return leverageTC [PREC]
     */
    function _getLeverageTC(uint256 lckAC_, uint256 nACgain_) internal view returns (uint256 leverageTC) {
        uint256 totalACavailable = _getTotalACavailable(nACgain_);
        // [PREC] = [N] * [PREC] / ([N] - [N])
        return _divPrec(totalACavailable, totalACavailable - lckAC_);
    }

    /**
     * @notice get bucket global coverage
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACgain_ amount of collateral asset to be distributed during settlement [N]
     * @return cglob [PREC]
     */
    function _getCglb(uint256 lckAC_, uint256 nACgain_) internal view returns (uint256 cglob) {
        if (lckAC_ == 0) return UINT256_MAX;
        // [PREC] = [N] * [PREC] / [N]
        return _divPrec(_getTotalACavailable(nACgain_), lckAC_);
    }

    // ------- Public Functions -------

    /**
     * @notice If liquidation is enabled, verifies if forced liquidation has been
     * reached, checking if globalCoverage <= liquidation
     * @return true if liquidation state is reached, false otherwise
     */
    function isLiquidationReached() public view returns (bool) {
        (uint256 lckAC, uint256 nACgain) = _getLckACandACgain();
        uint256 cglb = _getCglb(lckAC, nACgain);
        return cglb <= liqThrld;
    }

    /**
     * @notice evaluates if liquidation threshold has been reached and liq is Enabled.
     * If so forces contracts liquidation, blocking all mint & redeem operations.
     *
     * May emit a {ContractLiquidated} event.
     */
    function evalLiquidation() external notPaused {
        if (liqEnabled && !liquidated && isLiquidationReached()) {
            liquidated = true;
            tcToken.pause();
            // Freeze current Peg Price given the AC available
            settleLiquidationPrices();
            emit ContractLiquidated();
        }
    }

    /**
     * @notice get how many Pegged Token equal 1 Collateral Asset
     * @param i_ Pegged Token index
     * @return price [PREC]
     */
    function getPACtp(uint8 i_) public view virtual returns (uint256) {
        IPriceProvider priceProvider = pegContainer[i_].priceProvider;
        (bytes32 price, bool has) = priceProvider.peek();
        if (!has) revert InvalidPriceProvider(address(priceProvider));
        return uint256(price);
    }

    // ------- Only Authorized Changer Functions -------

    /**
     * @dev sets the fee pct to be retainer on AC fees payments as AC re-injection.
     * @param feeRetainer_  pct retain on fees to be re-injected as Collateral, while paying fees with AC [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setFeeRetainer(uint256 feeRetainer_) external onlyAuthorizedChanger {
        feeRetainer = feeRetainer_;
    }

    /**
     * @dev sets the fee charged on Token Collateral mint.
     * @param tcMintFee_ addition fee pct applied on Collateral Tokens mint [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setTcMintFee(uint256 tcMintFee_) external onlyAuthorizedChanger {
        tcMintFee = tcMintFee_;
    }

    /**
     * @dev sets the fee charged on Token Collateral redeem.
     * @param tcRedeemFee_ addition fee pct applied on Collateral Tokens redeem [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setTcRedeemFee(uint256 tcRedeemFee_) external onlyAuthorizedChanger {
        tcRedeemFee = tcRedeemFee_;
    }

    /**
     * @dev sets the fee charged when swap a Pegged Token for another Pegged Token.
     * @param swapTPforTPFee_ additional fee pct applied on swap a Pegged Token for another Pegged Token [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setSwapTPforTPFee(uint256 swapTPforTPFee_) external onlyAuthorizedChanger {
        swapTPforTPFee = swapTPforTPFee_;
    }

    /**
     * @dev sets the fee charged when swap a Pegged Token for Collateral Token.
     * @param swapTPforTCFee_ additional fee pct applied on swap a Pegged Token for Collateral Token [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setSwapTPforTCFee(uint256 swapTPforTCFee_) external onlyAuthorizedChanger {
        swapTPforTCFee = swapTPforTCFee_;
    }

    /**
     * @dev sets the fee charged when swap Collateral Token for a Pegged Token.
     * @param swapTCforTPFee_ additional fee pct applied on swap Collateral Token for a Pegged Token [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setSwapTCforTPFee(uint256 swapTCforTPFee_) external onlyAuthorizedChanger {
        swapTCforTPFee = swapTCforTPFee_;
    }

    /**
     * @dev sets the fee charged when redeem Collateral Token and Pegged Token in one operation.
     * @param redeemTCandTPFee_ additional fee pct applied on redeem Collateral Token and Pegged Token [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setRedeemTCandTPFee(uint256 redeemTCandTPFee_) external onlyAuthorizedChanger {
        redeemTCandTPFee = redeemTCandTPFee_;
    }

    /**
     * @dev sets the fee charged when mint Collateral Token and Pegged Token in one operation.
     * @param mintTCandTPFee_ additional fee pct applied on mint Collateral Token and Pegged Token [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setMintTCandTPFee(uint256 mintTCandTPFee_) external onlyAuthorizedChanger {
        mintTCandTPFee = mintTCandTPFee_;
    }

    /**
     * @dev sets Moc Fee Flow contract address
     * @param mocFeeFlowAddress_ moc Fee Flow new contract address
     */
    function setMocFeeFlowAddress(address mocFeeFlowAddress_) external onlyAuthorizedChanger {
        mocFeeFlowAddress = mocFeeFlowAddress_;
    }

    /**
     * @dev sets Moc Appreciation Beneficiary Address
     * @param mocAppreciationBeneficiaryAddress_ moc Appreciation Beneficiary new address
     */
    function setMocAppreciationBeneficiaryAddress(
        address mocAppreciationBeneficiaryAddress_
    ) external onlyAuthorizedChanger {
        mocAppreciationBeneficiaryAddress = mocAppreciationBeneficiaryAddress_;
    }

    /**
     * @dev sets the value of the protected threshold configuration param
     * @param protThrld_ coverage protected state threshold [PREC]
     */
    function setProtThrld(uint256 protThrld_) external onlyAuthorizedChanger {
        protThrld = protThrld_;
    }

    /**
     * @dev sets the value of the liq threshold configuration param
     * @param liqThrld_ liquidation threshold
     */
    function setLiqThrld(uint256 liqThrld_) external onlyAuthorizedChanger {
        liqThrld = liqThrld_;
    }

    /**
     * @dev enables and disables the liquidation mechanism.
     * @param liqEnabled_ is liquidation enabled
     */
    function setLiqEnabled(bool liqEnabled_) external onlyAuthorizedChanger {
        liqEnabled = liqEnabled_;
    }

    /**
     * @dev sets success Fee value.
     * @param successFee_ pct of the gain because Pegged Tokens devaluation that is
     * transferred in Collateral Asset to Moc Fee Flow during the settlement [PREC]
     */
    function setSuccessFee(uint256 successFee_) external onlyAuthorizedChanger {
        successFee = successFee_;
    }

    /**
     * @dev sets appreciation Factor value.
     * @param appreciationFactor_ pct of the gain because Pegged Tokens devaluation that is returned
     * in Pegged Tokens to appreciation beneficiary during the settlement [PREC]
     */
    function setAppreciationFactor(uint256 appreciationFactor_) external onlyAuthorizedChanger {
        appreciationFactor = appreciationFactor_;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
