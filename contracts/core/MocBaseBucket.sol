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
        // amount of Pegged Token used by a Token X
        uint256 nTPXV;
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
        // mocInterestCollector address
        address mocInterestCollectorAddress;
        // moc appreciation beneficiary Address
        address mocAppreciationBeneficiaryAddress;
        // protected state threshold [PREC]
        uint256 protThrld;
        // liquidation coverage threshold [PREC]
        uint256 liqThrld;
        // fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
        uint256 tcMintFee;
        // fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
        uint256 tcRedeemFee;
        // fee pct sent to Fee Flow for swap a Pegged Token for another Pegged Token [PREC]
        uint256 swapTPforTPFee;
        // pct of the gain because Pegged Tokens devaluation that is transferred
        // in Collateral Asset to Moc Fee Flow during the settlement [PREC]
        uint256 successFee;
        // pct of the gain because Pegged Tokens devaluation that is returned
        // in Pegged Tokens to appreciation beneficiary during the settlement [PREC]
        uint256 appreciationFactor;
    }

    // ------- Storage -------

    // total amount of Collateral Asset held in the Collateral Bag
    uint256 internal nACcb;
    // amount of Collateral Asset that the Vaults owe to the Collateral Bag
    uint256 internal nACioucb;

    // Collateral Token
    MocTC public tcToken;
    // Collateral Token total supply
    uint256 internal nTCcb;

    // Pegged Tokens MocRC20 addresses
    IMocRC20[] public tpTokens;
    // Pegged Token indexes
    mapping(address => PeggedTokenIndex) public peggedTokenIndex;
    // peg container
    PegContainerItem[] public pegContainer;
    // reserve factor
    uint256[] public tpR;
    // Pegged Token prices, at which they can be redeemed after liquidation event
    uint256[] internal tpLiqPrices;
    // pct of the gain because Pegged Tokens devaluation that is transferred
    // in Collateral Asset to Moc Fee Flow during the settlement [PREC]
    uint256 public successFee;
    // pct of the gain because Pegged Tokens devaluation that is returned
    // in Pegged Tokens to appreciation beneficiary during the settlement [PREC]
    uint256 public appreciationFactor;

    // ------- Storage Fees -------

    // fee pct sent to Fee Flow on Collateral Tokens mint [PREC]
    uint256 public tcMintFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // fee pct sent to Fee Flow on Collateral Tokens redeem [PREC]
    uint256 public tcRedeemFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // fee pct sent to Fee Flow for swap a Pegged Token for another Pegged Token [PREC]
    uint256 public swapTPforTPFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    // fee pct sent to Fee Flow on Pegged Tokens mint [PREC]
    uint256[] public tpMintFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // fee pct sent to Fee Flow on Pegged Tokens redeem [PREC]
    uint256[] public tpRedeemFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    // Moc Fee Flow contract address
    address public mocFeeFlowAddress;
    // Moc Interest Collector address
    address public mocInterestCollectorAddress;
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
        if (liquidated) revert Liquidated();
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
     *        mocInterestCollectorAddress mocInterestCollector address
     *        mocAppreciationBeneficiaryAddress Moc appreciation beneficiary address
     *        protThrld protected coverage threshold [PREC]
     *        liqThrld liquidation coverage threshold [PREC]
     *        tcMintFee fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
     *        tcRedeemFee fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
     *        swapTPforTPFee fee pct sent to Fee Flow for swap a Pegged Token for another Pegged Token [PREC]
     *        successFee pct of the gain because Pegged Tokens devaluation that is transferred
     *          in Collateral Asset to Moc Fee Flow during the settlement [PREC]
     *        appreciationFactor pct of the gain because Pegged Tokens devaluation that is returned
     *          in Pegged Tokens to appreciation beneficiary during the settlement [PREC]
     */
    function __MocBaseBucket_init_unchained(InitializeBaseBucketParams calldata initializeBaseBucketParams_)
        internal
        onlyInitializing
    {
        if (initializeBaseBucketParams_.protThrld < PRECISION) revert InvalidValue();
        if (initializeBaseBucketParams_.tcMintFee > PRECISION) revert InvalidValue();
        if (initializeBaseBucketParams_.tcRedeemFee > PRECISION) revert InvalidValue();
        if (initializeBaseBucketParams_.swapTPforTPFee > PRECISION) revert InvalidValue();
        if (initializeBaseBucketParams_.successFee + initializeBaseBucketParams_.appreciationFactor > PRECISION)
            revert InvalidValue();
        tcToken = MocTC(initializeBaseBucketParams_.tcTokenAddress);
        // Verifies it has the right roles over this TC
        if (!tcToken.hasFullRoles(address(this))) revert InvalidAddress();
        mocFeeFlowAddress = initializeBaseBucketParams_.mocFeeFlowAddress;
        mocInterestCollectorAddress = initializeBaseBucketParams_.mocInterestCollectorAddress;
        mocAppreciationBeneficiaryAddress = initializeBaseBucketParams_.mocAppreciationBeneficiaryAddress;
        mocSettlement = MocSettlement(initializeBaseBucketParams_.mocSettlementAddress);
        protThrld = initializeBaseBucketParams_.protThrld;
        liqThrld = initializeBaseBucketParams_.liqThrld;
        tcMintFee = initializeBaseBucketParams_.tcMintFee;
        tcRedeemFee = initializeBaseBucketParams_.tcRedeemFee;
        swapTPforTPFee = initializeBaseBucketParams_.swapTPforTPFee;
        successFee = initializeBaseBucketParams_.successFee;
        appreciationFactor = initializeBaseBucketParams_.appreciationFactor;
        liquidated = false;
        liqEnabled = false;
    }

    // ------- Internal Functions -------

    /**
     * @notice add Collateral Token and Collateral Asset to the Bucket
     * @param qTC_ amount of Collateral Token to add
     * @param qAC_ amount of Collateral Asset to add
     */
    function _depositTC(uint256 qTC_, uint256 qAC_) internal {
        nTCcb += qTC_;
        nACcb += qAC_;
    }

    /**
     * @notice subtract Collateral Token and Collateral Asset from the Bucket
     * @param qTC_ amount of Collateral Token to subtract
     * @param qAC_ amount of Collateral Asset to subtract
     */
    function _withdrawTC(uint256 qTC_, uint256 qAC_) internal {
        nTCcb -= qTC_;
        nACcb -= qAC_;
    }

    /**
     * @notice add Pegged Token and Collateral Asset to the Bucket
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to add
     * @param qAC_ amount of Collateral Asset to add
     */
    function _depositTP(
        uint8 i_,
        uint256 qTP_,
        uint256 qAC_
    ) internal {
        pegContainer[i_].nTP += qTP_;
        nACcb += qAC_;
    }

    /**
     * @notice subtract Pegged Token and Collateral Asset from the Bucket
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to subtract
     * @param qAC_ amount of Collateral Asset to subtract
     */
    function _withdrawTP(
        uint8 i_,
        uint256 qTP_,
        uint256 qAC_
    ) internal {
        pegContainer[i_].nTP -= qTP_;
        nACcb -= qAC_;
    }

    /**
     * @notice get how many Pegged Token equal 1 Collateral Asset
     * @param i_ Pegged Token index
     * @return price [PREC]
     */
    function _getPACtp(uint8 i_) internal view virtual returns (uint256) {
        IPriceProvider priceProvider = pegContainer[i_].priceProvider;
        (bytes32 price, bool has) = priceProvider.peek();
        if (!has) revert InvalidPriceProvider(address(priceProvider));
        return uint256(price);
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
     * @notice get abundance ratio (beginning) of Pegged Token
     * @param tpAvailableToRedeem_  amount Pegged Token available to redeem (nTP - nTPXV) [N]
     * @param nTPplusTPgain_ amount Pegged Token in the bucket + TP to be minted during settlement [N]
     * @return arb [PREC]
     */
    function _getArb(uint256 tpAvailableToRedeem_, uint256 nTPplusTPgain_) internal pure returns (uint256 arb) {
        // [PREC] = [N] * [PREC] / [N]
        return _divPrec(tpAvailableToRedeem_, nTPplusTPgain_);
    }

    /**
     * @notice get abundance ratio (final) of Pegged Token
     * @param tpAvailableToRedeem_  amount Pegged Token available to redeem (nTP - nTPXV) [N]
     * @param nTPplusTPgain_ amount Pegged Token in the bucket + TP to be minted during settlement [N]
     * @param qTP_ amount of Pegged Token to calculate the final abundance
     * @return arf [PREC]
     */
    function _getArf(
        uint256 tpAvailableToRedeem_,
        uint256 nTPplusTPgain_,
        uint256 qTP_
    ) internal pure returns (uint256 arf) {
        if (qTP_ >= nTPplusTPgain_) return ONE;
        // [N] = [N] - [N]
        uint256 den = nTPplusTPgain_ - qTP_;
        // [PREC] = [N] * [PREC] / [N]
        return _divPrec(tpAvailableToRedeem_ - qTP_, den);
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
        // TODO: check if should be totalACavailable =  nACcb + nACioucb - nACgain;
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
            pACtps[i] = _getPACtp(i);
            // [N] = [N] * [PREC] / [PREC]
            lckAC += _divPrec(pegContainer[i].nTP, pACtps[i]);
        }
        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            // [PREC] = [PREC] * [N] / [N];
            tpLiqPrices.push((pACtps[i] * lckAC) / totalACAvailable);
        }
    }

    /**
     * @notice @notice updates Pegged Token P&L and last operation price
     * @param i_ Pegged Token index
     * @param pACtp_ Pegged Token price [PREC]
     */
    function _updateTPtracking(uint8 i_, uint256 pACtp_) internal {
        uint256 tpAvailableToRedeem = pegContainer[i_].nTP - pegContainer[i_].nTPXV;
        tpiou[i_] += _getOtfPnLTP(i_, tpAvailableToRedeem, pACtp_);
        pACtpLstop[i_] = pACtp_;
    }

    /**
     * @notice @notice gets on the fly Pegged Token P&L
     * @param i_ Pegged Token index
     * @param tpAvailableToRedeem_  amount Pegged Token available to redeem (nTP - nTPXV) [N]
     * @param pACtp_ Pegged Token price [PREC]
     * @return otfPnLtp [N]
     */
    function _getOtfPnLTP(
        uint8 i_,
        uint256 tpAvailableToRedeem_,
        uint256 pACtp_
    ) internal view returns (int256 otfPnLtp) {
        // [PREC] = [N] * [PREC]
        tpAvailableToRedeem_ *= PRECISION;
        // [N] = [PREC] / [PREC] - [PREC] / [PREC]
        return int256(tpAvailableToRedeem_ / pACtpLstop[i_]) - int256(tpAvailableToRedeem_ / pACtp_);
    }

    /**
     * @notice @notice gets accumulated Pegged Token P&L
     * @param i_ Pegged Token index
     * @param tpAvailableToRedeem_  amount Pegged Token available to redeem (nTP - nTPXV) [N]
     * @param pACtp_ Pegged Token price [PREC]
     * @return tpGain amount of Pegged Token to be minted during settlement [N]
     * @return adjPnLtpi total amount of P&L in Collateral Asset [N]
     */
    function _getPnLTP(
        uint8 i_,
        uint256 tpAvailableToRedeem_,
        uint256 pACtp_
    ) internal view returns (uint256 tpGain, uint256 adjPnLtpi) {
        // [N] = [N] + [N]
        int256 adjPnLtpiAux = tpiou[i_] + _getOtfPnLTP(i_, tpAvailableToRedeem_, pACtp_);
        if (adjPnLtpiAux > 0) {
            // [N] = [N] + [N]
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
            uint256 tpAvailableToRedeem = pegContainer[i].nTP - pegContainer[i].nTPXV;
            uint256 pACtp = _getPACtp(i);
            (uint256 tpGain, uint256 adjPnLtpi) = _getPnLTP(i, tpAvailableToRedeem, pACtp);
            // [N] = ([N] - [N]) * [PREC] / [PREC]
            lckAC += _divPrec(tpAvailableToRedeem + tpGain, pACtp);
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
    function evalLiquidation() public {
        if (liqEnabled && !liquidated && isLiquidationReached()) {
            liquidated = true;
            tcToken.pause();
            // Freeze current Peg Price given the AC available
            settleLiquidationPrices();
            emit ContractLiquidated();
        }
    }

    // ------- Only Authorized Changer Functions -------

    /**
     * @dev sets the fee charged on Token Collateral mint.
     * @param tcMintFee_ fee pct sent to Fee Flow on Collateral Tokens mint [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setTcMintFee(uint256 tcMintFee_) external onlyAuthorizedChanger {
        tcMintFee = tcMintFee_;
    }

    /**
     * @dev sets the fee charged on Token Collateral redeem.
     * @param tcRedeemFee_ fee pct sent to Fee Flow on Collateral Tokens redeem [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setTcRedeemFee(uint256 tcRedeemFee_) external onlyAuthorizedChanger {
        tcRedeemFee = tcRedeemFee_;
    }

    /**
     * @dev sets the fee charged when swap a Pegged Token for another Pegged Token.
     * @param swapTPforTPFee_ fee pct sent to Fee Flow for swap a Pegged Token for another Pegged Token [PREC]
     * 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
     */
    function setSwapTPforTPFee(uint256 swapTPforTPFee_) external onlyAuthorizedChanger {
        swapTPforTPFee = swapTPforTPFee_;
    }

    /**
     * @dev sets Moc Fee Flow contract address
     * @param mocFeeFlowAddress_ moc Fee Flow new contract address
     */
    function setMocFeeFlowAddress(address mocFeeFlowAddress_) external onlyAuthorizedChanger {
        mocFeeFlowAddress = mocFeeFlowAddress_;
    }

    /**
     * @dev sets Moc Interest Collector address
     * @param mocInterestCollectorAddress_ moc Interest Collector new address
     */
    function setMocInterestCollectorAddress(address mocInterestCollectorAddress_) external onlyAuthorizedChanger {
        mocInterestCollectorAddress = mocInterestCollectorAddress_;
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
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
