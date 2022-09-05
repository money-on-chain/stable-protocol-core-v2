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
    IMocRC20 internal tcToken;
    // total supply of Collateral Token
    uint256 internal nTCcb;
    // fee pct sent to Fee Flow for mint Collateral Tokens
    uint256 internal tcMintFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // fee pct sent to Fee Flow for redeem Collateral Tokens
    uint256 internal tcRedeemFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    // Pegged Token
    IMocRC20[] internal tpToken;
    // peg container
    PegContainerItem[] internal pegContainer;
    // reserve factor
    uint256[] internal tpR;
    // minimum amount of blocks until the settlement to charge interest for the redemption of Pegged Token
    uint256[] internal tpBmin;
    // fee pct sent to Fee Flow for mint Pegged Tokens
    uint256[] internal tpMintFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // fee pct sent to Fee Flow for redeem Pegged Tokens
    uint256[] internal tpRedeemFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    // global target coverage of the model
    uint256 public ctarg;
    // Moc Fee Flow contract address
    address internal mocFeeFlowAddress;

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
     * @notice sub Collateral Token and Collateral Asset to the Bucket
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
     * @notice get Pegged Token price
     * @param i_ Pegged Token index
     * @return price [PREC]
     */
    function _getPTPac(uint8 i_) internal view virtual returns (uint256) {
        IPriceProvider priceProvider = pegContainer[i_].priceProvider;
        (bytes32 price, bool has) = priceProvider.peek();
        if (!has) revert InvalidPriceProvider(address(priceProvider));
        return uint256(price);
    }

    /**
     * @notice get amount of Collateral Asset locked by Pegged Token adjusted by EMA
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @return lckACemaAdjusted [PREC]
     */
    function _getLckACemaAdjusted(uint256 ctargemaCA_, uint256 lckAC_)
        internal
        view
        returns (uint256 lckACemaAdjusted)
    {
        // [PREC] = ([N] + [N]) * [PREC] - [PREC] * [PREC] / [PREC]
        return (nACcb + nACioucb) * PRECISION - (ctargemaCA_ * lckAC_) / PRECISION;
    }

    /**
     * @notice get amount of Collateral Token available to redeem
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @return tcAvailableToRedeem [N]
     */
    function _getTCAvailableToRedeem(uint256 ctargemaCA_, uint256 lckAC_)
        internal
        view
        returns (uint256 tcAvailableToRedeem)
    {
        // [PREC]
        uint256 lckACemaAdjusted = _getLckACemaAdjusted(ctargemaCA_, lckAC_);
        // [N] = [PREC] / [PREC]
        return lckACemaAdjusted / getPTCac(lckAC_);
    }

    /**
     * @notice get amount of Pegged Token available to mint
     * @param ctargemaCA_ target coverage adjusted by the moving average of the value of the Collateral Asset [PREC]
     * @param pTPac_ Pegged Token price [PREC]
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @return tpAvailableToMint [N]
     */
    function _getTPAvailableToMint(
        uint256 ctargemaCA_,
        uint256 pTPac_,
        uint256 lckAC_
    ) internal view returns (uint256 tpAvailableToMint) {
        // [PREC]
        uint256 lckACemaAdjusted = _getLckACemaAdjusted(ctargemaCA_, lckAC_);
        // [PREC] = [PREC] * ([PREC] - [PREC]) / [PREC]
        uint256 den = (pTPac_ * (ctargemaCA_ - ONE)) / PRECISION;
        // [N] = [PREC] / [PREC]
        return lckACemaAdjusted / den;
    }

    // ------- Public Functions -------

    /**
     * @notice get amount of Collateral Asset locked by Pegged Token
     * @return lckAC [PREC]
     */
    function getLckAC() public view returns (uint256 lckAC) {
        uint256 pegAmount = pegContainer.length;
        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            // [PREC] = [N] * [PREC]
            lckAC += pegContainer[i].nTP * _getPTPac(i);
        }
    }

    /**
     * @notice get Collateral Token price
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @return pTCac [PREC]
     */
    function _getPTCac(uint256 lckAC_) internal view returns (uint256 pTCac) {
        if (nTCcb == 0) return ONE;
        // [PREC] = [N] + [N] * [PREC] - [PREC]
        pTCac = (nACcb + nACioucb) * PRECISION - lckAC_;
        // [PREC] = [PREC] / [N]
        pTCac /= nTCcb;
    }

    /**
     * @notice get bucket global coverage
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @return cglob [PREC]
     */
    function _getCglb(uint256 lckAC_) internal view returns (uint256 cglob) {
        if (lckAC_ == 0) return UINT256_MAX;
        // [PREC] = ([N] + [N]) * [PREC]
        cglob = (nACcb + nACioucb) * PRECISION;
        // [PREC] = [PREC] * [PREC] / [PREC]
        cglob = (cglob * PRECISION) / lckAC_;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
