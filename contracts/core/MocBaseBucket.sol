pragma solidity ^0.8.16;

import "../interfaces/IMocRC20.sol";
import "../interfaces/IPriceProvider.sol";
import "../governance/MocUpgradable.sol";

/**
 * @title MocBaseBucket: Moc Collateral Bag
 * @notice MocBaseBucket holds Bucket Zero state, both for the Callateral Bag and PegggedTokens Items.
 * @dev Abstracts all rw opeartions on the main bucket and expose all calculations relative to its state.
 */
abstract contract MocBaseBucket is MocUpgradable {
    // ------- Custom Errors -------
    error InvalidPriceProvider(address priceProviderAddress_);
    error TransferFailed();
    error ContractLiquidated();
    error LowCoverage(uint256 cglb_, uint256 covThrld_);

    // ------- Structs -------
    struct PegContainerItem {
        // total supply of Pegged Token
        uint256 nTP;
        // amount of Pegged Token used by a Token X
        uint256 nTPXV;
        // PegToken PriceFeed address
        IPriceProvider priceProvider;
    }

    // ------- Storage -------

    // total amount of Collateral Asset holded in the Collateral Bag
    uint256 internal nACcb;
    // amount of Collateral Asset that the Vaults owe to the Collateral Bag
    uint256 internal nACioucb;

    // Collateral Token
    IMocRC20 public tcToken;
    // total supply of Collateral Token
    uint256 internal nTCcb;

    // Pegged Token
    IMocRC20[] internal tpToken;
    // Pegged Token indexes
    mapping(address => uint8) internal peggedTokenIndex;
    // peg container
    PegContainerItem[] internal pegContainer;
    // reserve factor
    uint256[] internal tpR;
    // minimum amount of blocks until the settlement to charge interest for the redemption of Pegged Token
    uint256[] internal tpBmin;

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

    // ------- Storage Coverage Tracking -------

    // global target coverage of the model [PREC]
    uint256 public ctarg;
    // coverage protected state threshold [PREC]
    uint256 internal protThrld;
    // coverage liquidation threshold [PREC]
    uint256 internal liqThrld;
    // liquidation enabled
    bool internal liqEnabled;
    // Irreversible state, peg lost, contract is terminated and all funds can be withdrawn
    bool internal liquidated;

    // ------- Modifiers -------
    modifier notLiquidated() {
        if (liquidated) revert ContractLiquidated();
        _;
    }

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param tcTokenAddress_ Collateral Token contract address
     * @param mocFeeFlowAddress_ Moc Fee Flow contract address
     * @param ctarg_ global target coverage of the model [PREC]
     * @param protThrld_ protected state threshold [PREC]
     * @param tcMintFee_ fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
     * @param tcRedeemFee_ fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
     */
    function __MocBaseBucket_init_unchained(
        address tcTokenAddress_,
        address mocFeeFlowAddress_,
        uint256 ctarg_,
        uint256 protThrld_,
        uint256 tcMintFee_,
        uint256 tcRedeemFee_
    ) internal onlyInitializing {
        if (tcTokenAddress_ == address(0)) revert InvalidAddress();
        if (mocFeeFlowAddress_ == address(0)) revert InvalidAddress();
        if (ctarg_ < PRECISION) revert InvalidValue();
        if (protThrld_ < PRECISION) revert InvalidValue();
        if (tcMintFee_ > PRECISION) revert InvalidValue();
        if (tcRedeemFee_ > PRECISION) revert InvalidValue();
        tcToken = IMocRC20(tcTokenAddress_);
        mocFeeFlowAddress = mocFeeFlowAddress_;
        ctarg = ctarg_;
        protThrld = protThrld_;
        tcMintFee = tcMintFee_;
        tcRedeemFee = tcRedeemFee_;
        // TODO
        liquidated = false;
        liqEnabled = true;
        liqThrld = ONE;
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
     * @param qTC_ amount of Collateral Token to sub
     * @param qAC_ amount of Collateral Asset to sub
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
     * @param ctargema_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @return lckACemaAdjusted [PREC]
     */
    function _getLckACemaAdjusted(uint256 ctargema_, uint256 lckAC_) internal view returns (uint256 lckACemaAdjusted) {
        // [PREC] = ([N] + [N]) * [PREC] - [PREC] * [N]
        return (nACcb + nACioucb) * PRECISION - (ctargema_ * lckAC_);
    }

    /**
     * @notice get amount of Collateral Token available to redeem
     * @param ctargema_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @return tcAvailableToRedeem [N]
     */
    function _getTCAvailableToRedeem(uint256 ctargema_, uint256 lckAC_)
        internal
        view
        returns (uint256 tcAvailableToRedeem)
    {
        // [PREC]
        uint256 lckACemaAdjusted = _getLckACemaAdjusted(ctargema_, lckAC_);
        // [N] = [PREC] / [PREC]
        return lckACemaAdjusted / _getPTCac(lckAC_);
    }

    /**
     * @notice get amount of Pegged Token available to mint
     * @param ctargema_ target coverage adjusted by the moving average of the value of the Collateral Asset
     * @param pACtp_ Collateral Asset price in amount of Pegged Token [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @return tpAvailableToMint [N]
     */
    function _getTPAvailableToMint(
        uint256 ctargema_,
        uint256 pACtp_,
        uint256 lckAC_
    ) internal view returns (uint256 tpAvailableToMint) {
        // [PREC]
        uint256 lckACemaAdjusted = _getLckACemaAdjusted(ctargema_, lckAC_);
        // [PREC] = [PREC] * [PREC] / [PREC]
        uint256 num = (lckACemaAdjusted * pACtp_) / PRECISION;
        // [PREC] = [PREC] - [PREC]
        uint256 den = ctargema_ - ONE;
        // [N] = [PREC] / [PREC]
        return num / den;
    }

    // ------- Public Functions -------

    /**
     * @notice get amount of Collateral Asset locked by Pegged Token
     * @return lckAC [N]
     */
    function getLckAC() public view returns (uint256 lckAC) {
        uint256 pegAmount = pegContainer.length;
        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            // [N] = [N] * [PREC] / [PREC]
            lckAC += (pegContainer[i].nTP * PRECISION) / _getPACtp(i);
        }
    }

    /**
     * @notice get Collateral Token price
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @return pTCac [PREC]
     */
    function _getPTCac(uint256 lckAC_) internal view returns (uint256 pTCac) {
        if (nTCcb == 0) return ONE;
        // [PREC] = (([N] + [N] - [N]) * [PREC]) / [N]
        return ((nACcb + nACioucb - lckAC_) * PRECISION) / nTCcb;
    }

    /**
     * @notice get bucket global coverage
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [N]
     * @return cglob [PREC]
     */
    function _getCglb(uint256 lckAC_) internal view returns (uint256 cglob) {
        if (lckAC_ == 0) return UINT256_MAX;
        // [PREC] = (([N] + [N]) * [PREC]) / [N]
        return ((nACcb + nACioucb) * PRECISION) / lckAC_;
    }

    /**
     * @notice If liquidation is enabled, verifies if forced liquidation has been
     * reached, checking if globalCoverage <= liquidation
     * @return true if liquidation state is reached, false otherwise
     */
    function isLiquidationReached() public view returns (bool) {
        uint256 lckAC = getLckAC();
        uint256 cglb = _getCglb(lckAC);
        return liqEnabled && cglb <= liqThrld;
    }

    /**
     * @notice evaluates if liquidation threshold has been reached, and forces contracts liquidation
     * @return wasLiquidated true if the contract was liquidated
     */
    function evalLiquidation() public returns (bool wasLiquidated) {
        if (isLiquidationReached()) {
            liquidated = true;
            // TODO: complete liquidation process
            return true;
        }
        return false;
    }

    /**
     * @notice evaluates wheather or not the coverage is over the cThrld_, reverts if below
     * @param cThrld_ coverage threshold to check for [PREC]
     * @return lckAC amount of Collateral Asset locked by Pegged Tokens [PREC]
     */
    function _evalCoverage(uint256 cThrld_) internal view returns (uint256 lckAC) {
        lckAC = getLckAC();
        uint256 cglb = _getCglb(lckAC);

        // check if coverage is above the given threshold
        if (cglb <= cThrld_) revert LowCoverage(cglb, cThrld_);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
