pragma solidity ^0.8.16;

import "../interfaces/IMocRC20.sol";
import "../tokens/MocTC.sol";
import "../interfaces/IPriceProvider.sol";
import "../governance/MocUpgradable.sol";
import "../MocSettlement.sol";

/**
 * @title MocBaseBucket: Moc Collateral Bag
 * @notice MocBaseBucket holds Bucket Zero state, both for the Callateral Bag and PegggedTokens Items.
 * @dev Abstracts all rw opeartions on the main bucket and expose all calculations relative to its state.
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
        // true if Pegged Token exist
        bool exist;
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
        // mocTurbo Address
        address mocTurboAddress;
        // protected state threshold [PREC]
        uint256 protThrld;
        // liquidation coverage threshold [PREC]
        uint256 liqThrld;
        // fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
        uint256 tcMintFee;
        // fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
        uint256 tcRedeemFee;
        // success fee: proportion of the devaluation that is transferred to Moc Fee Flow during the settlement [PREC]
        uint256 sf;
        // appreciation factor: proportion of the devaluation that is returned to Turbo during the settlement [PREC]
        uint256 fa;
    }

    // ------- Storage -------

    // total amount of Collateral Asset holded in the Collateral Bag
    uint256 internal nACcb;
    // amount of Collateral Asset that the Vaults owe to the Collateral Bag
    uint256 internal nACioucb;

    // Collateral Token
    MocTC public tcToken;
    // total supply of Collateral Token
    uint256 internal nTCcb;

    // Pegged Tokens MocRC20 addresses
    IMocRC20[] public tpTokens;
    // Pegged Token indexes
    mapping(address => PeggedTokenIndex) internal peggedTokenIndex;
    // peg container
    PegContainerItem[] internal pegContainer;
    // reserve factor
    uint256[] internal tpR;
    // prices for each TP, at wich they can be redeem after liquidation event
    uint256[] internal tpLiqPrices;
    // success fee: proportion of the devaluation that is transferred to Moc Fee Flow during the settlement [PREC]
    uint256 internal sf;
    // appreciation factor: proportion of the devaluation that is returned to Turbo during the settlement [PREC]
    uint256 internal fa;

    // ------- Storage Fees -------

    // fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
    uint256 internal tcMintFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
    uint256 internal tcRedeemFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    // fee pct sent to Fee Flow for mint Pegged Tokens [PREC]
    uint256[] internal tpMintFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // fee pct sent to Fee Flow for redeem Pegged Tokens [PREC]
    uint256[] internal tpRedeemFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    // Moc Fee Flow contract address
    address internal mocFeeFlowAddress;
    // Moc Interest Collector address
    address internal mocInterestCollectorAddress;
    // Moc Turbo address
    address internal mocTurboAddress;
    // MocSettlement contract
    MocSettlement internal mocSettlement;

    // ------- Storage Coverage Tracking -------

    // target coverage for each Pegged Token [PREC]
    uint256[] public tpCtarg;
    // coverage protected state threshold [PREC]
    uint256 public protThrld;
    // coverage liquidation threshold [PREC]
    uint256 public liqThrld;
    // liquidation enabled
    bool public liqEnabled;
    // Irreversible state, peg lost, contract is terminated and all funds can be withdrawn
    bool public liquidated;

    // ------- Storage Last Settlement Tracking -------

    // amount of collateral asset locked by Pegged Token at last settlement
    uint256 internal lckACLstset;
    // total supply of Pegged Token at last settlement
    uint256[] internal nTPLstset;
    // Pegged Token price at last settlement
    uint256[] internal pACtpLstset;

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
     *        mocTurboAddress mocTurbo address
     *        protThrld protected coverage threshold [PREC]
     *        liqThrld liquidation coverage threshold [PREC]
     *        tcMintFee fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
     *        tcRedeemFee fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
     *        sf proportion of the devaluation that is transferred to MoC Fee Flow during the settlement [PREC]
     *        fa proportion of the devaluation that is returned to Turbo during the settlement [PREC]
     */
    function __MocBaseBucket_init_unchained(InitializeBaseBucketParams calldata initializeBaseBucketParams_)
        internal
        onlyInitializing
    {
        if (initializeBaseBucketParams_.mocFeeFlowAddress == address(0)) revert InvalidAddress();
        if (initializeBaseBucketParams_.mocInterestCollectorAddress == address(0)) revert InvalidAddress();
        if (initializeBaseBucketParams_.mocTurboAddress == address(0)) revert InvalidAddress();
        if (initializeBaseBucketParams_.mocSettlementAddress == address(0)) revert InvalidAddress();
        if (initializeBaseBucketParams_.protThrld < PRECISION) revert InvalidValue();
        if (initializeBaseBucketParams_.tcMintFee > PRECISION) revert InvalidValue();
        if (initializeBaseBucketParams_.tcRedeemFee > PRECISION) revert InvalidValue();
        if (initializeBaseBucketParams_.sf > PRECISION) revert InvalidValue();
        if (initializeBaseBucketParams_.fa > PRECISION) revert InvalidValue();
        tcToken = MocTC(initializeBaseBucketParams_.tcTokenAddress);
        // Verifies it has the right roles over this TC
        if (
            !tcToken.hasRole(tcToken.PAUSER_ROLE(), address(this)) ||
            !tcToken.hasRole(tcToken.MINTER_ROLE(), address(this)) ||
            !tcToken.hasRole(tcToken.BURNER_ROLE(), address(this)) ||
            !tcToken.hasRole(tcToken.DEFAULT_ADMIN_ROLE(), address(this))
        ) {
            revert InvalidAddress();
        }
        mocFeeFlowAddress = initializeBaseBucketParams_.mocFeeFlowAddress;
        mocInterestCollectorAddress = initializeBaseBucketParams_.mocInterestCollectorAddress;
        mocTurboAddress = initializeBaseBucketParams_.mocTurboAddress;
        mocSettlement = MocSettlement(initializeBaseBucketParams_.mocSettlementAddress);
        protThrld = initializeBaseBucketParams_.protThrld;
        liqThrld = initializeBaseBucketParams_.liqThrld;
        tcMintFee = initializeBaseBucketParams_.tcMintFee;
        tcRedeemFee = initializeBaseBucketParams_.tcRedeemFee;
        sf = initializeBaseBucketParams_.sf;
        fa = initializeBaseBucketParams_.fa;
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
     * @param nACtoMint_ amount of Collateral Asset that will be distributed at
     *         settlement because Pegged Token devaluation [N]
     * @return lckACemaAdjusted [PREC]
     */
    function _getLckACemaAdjusted(
        uint256 ctargemaCA_,
        uint256 lckAC_,
        uint256 nACtoMint_
    ) internal view returns (uint256 lckACemaAdjusted) {
        // [PREC] = [N] * [PREC] - [PREC] * [N]
        return _getTotalACavailable(nACtoMint_) * PRECISION - ctargemaCA_ * lckAC_;
    }

    /**
     * @notice get amount of Collateral Token available to redeem
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACtoMint_ amount of Collateral Asset that will be distributed at
     *         settlement because Pegged Token devaluation [N]
     * @return tcAvailableToRedeem [N]
     */
    function _getTCAvailableToRedeem(
        uint256 ctargemaCA_,
        uint256 lckAC_,
        uint256 nACtoMint_
    ) internal view returns (uint256 tcAvailableToRedeem) {
        // [PREC]
        uint256 lckACemaAdjusted = _getLckACemaAdjusted(ctargemaCA_, lckAC_, nACtoMint_);
        // [N] = [PREC] / [PREC]
        return lckACemaAdjusted / _getPTCac(lckAC_, nACtoMint_);
    }

    /**
     * @notice get amount of Pegged Token available to mint
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset
     * @param pACtp_ Collateral Asset price in amount of Pegged Token [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACtoMint_ amount of Collateral Asset that will be distributed at
     *         settlement because Pegged Token devaluation [N]
     * @return tpAvailableToMint [N]
     */
    function _getTPAvailableToMint(
        uint256 ctargemaCA_,
        uint256 ctargemaTP_,
        uint256 pACtp_,
        uint256 lckAC_,
        uint256 nACtoMint_
    ) internal view returns (uint256 tpAvailableToMint) {
        // [PREC]
        uint256 lckACemaAdjusted = _getLckACemaAdjusted(ctargemaCA_, lckAC_, nACtoMint_);
        // [PREC] = [PREC] * [PREC] / [PREC]
        uint256 pACtpEmaAdjusted = (ctargemaCA_ * pACtp_) / ctargemaTP_;
        // [PREC] = [PREC] * [PREC] / [PREC]
        uint256 num = (lckACemaAdjusted * pACtpEmaAdjusted) / PRECISION;
        // [PREC] = [PREC] - [PREC]
        uint256 den = ctargemaCA_ - ONE;
        // [N] = [PREC] / [PREC]
        return num / den;
    }

    /**
     * @notice get abundance ratio (beginning) of Pegged Token
     * @param tpAvailableToRedeem_  amount Pegged Token available to redeem (nTP - nTPXV) [N]
     * @param nTP_ amount Pegged Token in the bucket [N]
     * @return arb [PREC]
     */
    function _getArb(uint256 tpAvailableToRedeem_, uint256 nTP_) internal pure returns (uint256 arb) {
        // [PREC] = [N] * [PREC] / [N]
        return (tpAvailableToRedeem_ * PRECISION) / nTP_;
    }

    /**
     * @notice get abundance ratio (final) of Pegged Token
     * @param tpAvailableToRedeem_  amount Pegged Token available to redeem (nTP - nTPXV) [N]
     * @param nTP_ amount Pegged Token in the bucket [N]
     * @param qTP_ amount of Pegged Token to calculate the final abundance
     * @return arf [PREC]
     */
    function _getArf(
        uint256 tpAvailableToRedeem_,
        uint256 nTP_,
        uint256 qTP_
    ) internal pure returns (uint256 arf) {
        // [N] = [N] - [N]
        uint256 den = nTP_ - qTP_;
        if (den == 0) return ONE;
        // [PREC] = [N] * [PREC] / [N]
        return ((tpAvailableToRedeem_ - qTP_) * PRECISION) / den;
    }

    /**
     * @notice evaluates wheather or not the coverage is over the cThrld_, reverts if below
     * @param cThrld_ coverage threshold to check for [PREC]
     * @return lckAC amount of Collateral Asset locked by Pegged Tokens [PREC]
     * @return nACtoMint amount of Collateral Asset that will be distributed at
     *         settlement because Pegged Token devaluation [N]
     */
    function _evalCoverage(uint256 cThrld_) internal view returns (uint256 lckAC, uint256 nACtoMint) {
        lckAC = _getLckAC();
        nACtoMint = _getACtoMint(lckAC);
        uint256 cglb = _getCglb(lckAC, nACtoMint);

        // check if coverage is above the given threshold
        if (cglb <= cThrld_) revert LowCoverage(cglb, cThrld_);
    }

    /**
     * @dev Calculates price at liquidation event as a relation between Pegs total supply
     * and the amount of Asset Collateral available to distribute
     */
    function settleLiquidationPrices() internal {
        // Total amount of AC available to be redeemed
        // TODO: check if should be totalACavailable =  nACcb + nACioucb - nACtoMint;
        uint256 totalACAvailable = nACcb + nACioucb;
        if (totalACAvailable == 0) return;
        uint256 pegAmount = pegContainer.length;
        // this could be get by getLckAC(), but given the prices are needed after,
        // it's better to cache them here.
        uint256 lckAC;
        // Auxiliar cache of pegs pACtp
        uint256[] memory pACtps = new uint256[](pegAmount);
        // for each peg, calculates the proportion of AC reserves it's locked

        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            pACtps[i] = _getPACtp(i);
            // [N] = [N] * [PREC] / [PREC]
            lckAC += (pegContainer[i].nTP * PRECISION) / pACtps[i];
        }
        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            // [PREC] = [PREC] * [N] / [N];
            tpLiqPrices.push((pACtps[i] * lckAC) / totalACAvailable);
        }
    }

    /**
     * @notice this function is executed during settlement and
     * stores amount of tokens in the bucket at this moment:
     *  - lckACLstset
     *  - pegContainer[i].nTPLstset
     *  - pegContainer[i].pACtpLstset
     */
    function _updateBucketLstset() internal {
        lckACLstset = _getLckAC();
        uint256 pegAmount = pegContainer.length;
        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            nTPLstset[i] = pegContainer[i].nTP;
            pACtpLstset[i] = _getPACtp(i);
        }
    }

    /**
     * @notice get amount of Collateral Asset locked by Pegged Token
     * @return lckAC [N]
     */
    function _getLckAC() internal view returns (uint256 lckAC) {
        uint256 pegAmount = pegContainer.length;
        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            // [N] = [N] * [PREC] / [PREC]
            lckAC += (pegContainer[i].nTP * PRECISION) / _getPACtp(i);
        }
    }

    /**
     * @notice get amount of Collateral Asset that will be distributed at settlement because Pegged Token devaluation
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @return nACtoMint [N]
     */
    function _getACtoMint(uint256 lckAC_) internal view returns (uint256 nACtoMint) {
        if (lckACLstset > lckAC_) {
            // [N] = ([N] - [N]) * ([PREC] + [PPREC]) / [PREC]
            return ((lckACLstset - lckAC_) * (fa + sf)) / PRECISION;
        }
    }

    /**
     * @notice get total Collateral Asset available
     * @param nACtoMint_ amount of Collateral Asset that will be distributed at
     *         settlement because Pegged Token devaluation [N]
     * @return totalACavailable [N]
     */
    function _getTotalACavailable(uint256 nACtoMint_) internal view returns (uint256 totalACavailable) {
        // [N] = [N] + [N] - [N]
        return nACcb + nACioucb - nACtoMint_;
    }

    /**
     * @notice get Collateral Token price
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACtoMint_ amount of Collateral Asset that will be distributed at
     *         settlement because Pegged Token devaluation [N]
     * @return pTCac [PREC]
     */
    function _getPTCac(uint256 lckAC_, uint256 nACtoMint_) internal view returns (uint256 pTCac) {
        if (nTCcb == 0) return ONE;
        // [PREC] = ([N] - [N]) * [PREC]) / [N]
        return ((_getTotalACavailable(nACtoMint_) - lckAC_) * PRECISION) / nTCcb;
    }

    /**
     * @notice get bucket global coverage
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @param nACtoMint_ amount of Collateral Asset that will be distributed at
     *         settlement because Pegged Token devaluation [N]
     * @return cglob [PREC]
     */
    function _getCglb(uint256 lckAC_, uint256 nACtoMint_) internal view returns (uint256 cglob) {
        if (lckAC_ == 0) return UINT256_MAX;
        // [PREC] = [N] * [PREC] / [N]
        return (_getTotalACavailable(nACtoMint_) * PRECISION) / lckAC_;
    }

    // ------- Public Functions -------

    /**
     * @notice get Collateral Token price
     * @return pTCac [PREC]
     */
    function getPTCac() public view returns (uint256 pTCac) {
        uint256 lckAC = _getLckAC();
        uint256 nACtoMint = _getACtoMint(lckAC);
        return _getPTCac(lckAC, nACtoMint);
    }

    /**
     * @notice get bucket global coverage
     * @return cglob [PREC]
     */
    function getCglb() public view returns (uint256 cglob) {
        uint256 lckAC = _getLckAC();
        uint256 nACtoMint = _getACtoMint(lckAC);
        return _getCglb(lckAC, nACtoMint);
    }

    /**
     * @notice If liquidation is enabled, verifies if forced liquidation has been
     * reached, checking if globalCoverage <= liquidation
     * @return true if liquidation state is reached, false otherwise
     */
    function isLiquidationReached() public view returns (bool) {
        uint256 lckAC = _getLckAC();
        uint256 nACtoMint = _getACtoMint(lckAC);
        uint256 cglb = _getCglb(lckAC, nACtoMint);
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
