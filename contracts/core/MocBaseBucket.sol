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
    // protected state threshold
    uint256 internal protThrld;

    // Collateral Token
    IMocRC20 public tcToken;
    // total supply of Collateral Token
    uint256 internal nTCcb;
    // fee pct sent to Fee Flow for mint Collateral Tokens
    uint256 internal tcMintFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // fee pct sent to Fee Flow for redeem Collateral Tokens
    uint256 internal tcRedeemFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    // Pegged Token
    IMocRC20[] internal tpToken;
    // Pegged Token indexes
    mapping(address => uint8) internal peggedTokenIndex;
    // peg container
    PegContainerItem[] internal pegContainer;
    // reserve factor
    uint256[] internal tpR;
    // fee pct sent to Fee Flow for mint Pegged Tokens
    uint256[] internal tpMintFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // fee pct sent to Fee Flow for redeem Pegged Tokens
    uint256[] internal tpRedeemFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    // global target coverage of the model
    uint256 public ctarg;
    // Moc Fee Flow contract address
    address internal mocFeeFlowAddress;
    // Moc Interest Collector address
    address internal mocInterestCollectorAddress;

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param tcTokenAddress_ Collateral Token contract address
     * @param mocFeeFlowAddress_ Moc Fee Flow contract address
     * @param mocInterestCollectorAddress_ mocInterestCollector address
     * @param ctarg_ global target coverage of the model [PREC]
     * @param protThrld_ protected state threshold [PREC]
     * @param tcMintFee_ fee pct sent to Fee Flow for mint Collateral Tokens [PREC]
     * @param tcRedeemFee_ fee pct sent to Fee Flow for redeem Collateral Tokens [PREC]
     */
    function __MocBaseBucket_init_unchained(
        address tcTokenAddress_,
        address mocFeeFlowAddress_,
        address mocInterestCollectorAddress_,
        uint256 ctarg_,
        uint256 protThrld_,
        uint256 tcMintFee_,
        uint256 tcRedeemFee_
    ) internal onlyInitializing {
        if (tcTokenAddress_ == address(0)) revert InvalidAddress();
        if (mocFeeFlowAddress_ == address(0)) revert InvalidAddress();
        if (mocInterestCollectorAddress_ == address(0)) revert InvalidAddress();
        bool[] memory invalidValue = new bool[](4);
        invalidValue[0] = ctarg_ < PRECISION;
        invalidValue[1] = protThrld_ < PRECISION;
        invalidValue[2] = tcMintFee_ > PRECISION;
        invalidValue[3] = tcRedeemFee_ > PRECISION;
        for (uint8 i = 0; i < invalidValue.length; i = unchecked_inc(i)) if (invalidValue[i]) revert InvalidValue();
        tcToken = IMocRC20(tcTokenAddress_);
        mocFeeFlowAddress = mocFeeFlowAddress_;
        mocInterestCollectorAddress = mocInterestCollectorAddress_;
        ctarg = ctarg_;
        protThrld = protThrld_;
        tcMintFee = tcMintFee_;
        tcRedeemFee = tcRedeemFee_;
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

    /**
     * @notice get amount of Pegged Token available to redeem
     * @param i_ Pegged Token index
     * @return tpAvailableToRedeem [N]
     */
    function _getTPAvailableToRedeem(uint8 i_) internal view returns (uint256 tpAvailableToRedeem) {
        // [N] = [N] - [N]
        return pegContainer[i_].nTP - pegContainer[i_].nTPXV;
    }

    /**
     * @notice get initial abundance of Pegged Token
     * @param i_ Pegged Token index
     * @return arb [PREC]
     */
    function _getArb(uint8 i_) internal view returns (uint256 arb) {
        uint256 tpAvailableToRedeem = _getTPAvailableToRedeem(i_);
        // [PREC] = [N] * [PREC] / [N]
        return (tpAvailableToRedeem * PRECISION) / pegContainer[i_].nTP;
    }

    /**
     * @notice get final abundance of Pegged Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to calculate the final abundance
     * @return arf [PREC]
     */
    function _getArf(uint8 i_, uint256 qTP_) internal view returns (uint256 arf) {
        uint256 tpAvailableToRedeem = _getTPAvailableToRedeem(i_);
        // [PREC] = [N] * [PREC] / [N]
        return ((tpAvailableToRedeem - qTP_) * PRECISION) / (pegContainer[i_].nTP - qTP_);
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
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
