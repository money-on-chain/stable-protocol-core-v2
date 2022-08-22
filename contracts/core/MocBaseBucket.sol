// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../utils/MocHelper.sol";
import "../tokens/MocRC20.sol";
import "../interfaces/IMocRC20.sol";
import "../interfaces/IPriceProvider.sol";

/**
 * @title MocBaseBucket: Moc Collateral Bag
 * @notice MocBaseBucket holds Bucket Zero state, both for the Callateral Bag and PegggedTokens Items.
 * @dev Abstracts all rw opeartions on the main bucket and expose all calculations relative to its state.
 */
abstract contract MocBaseBucket is MocHelper {
    // ------- Custom Errors -------
    error InvalidPriceProvider(address priceProviderAddress_);
    error TransferFail();

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
    // total supply of Pegged Token
    uint256[] internal nTP;
    // amount of Pegged Token used by a Token X
    uint256[] internal nTPXV;
    // reserve factor
    uint256[] internal tpR;
    // minimum amount of blocks until the settlement to charge interest for the redemption of Pegged Token
    uint256[] internal tpBmin;
    // fee pct sent to Fee Flow for mint Pegged Tokens
    uint256[] internal tpMintFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // fee pct sent to Fee Flow for redeem Pegged Tokens
    uint256[] internal tpRedeemFee; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    // PegToken PriceFeed address
    IPriceProvider[] internal tpPriceProvider;

    // global target coverage of the model
    uint256 internal ctarg;
    // Moc Fee Flow contract address
    address internal mocFeeFlowAddress;

    // ------- Internal Functions -------

    /**
     * @notice add Collateral Token and Collateral Asset to the Bucket
     * @param qTC_ amount of Collateral Token to add
     * @param qAC_ amount of Collateral to add
     */
    function _depositTC(uint256 qTC_, uint256 qAC_) internal {
        nTCcb += qTC_;
        nACcb += qAC_;
    }

    /**
     * @notice get Pegged Token price
     * @param priceProvider_ oracle address who provide Pegged Token price
     * @return price [PREC]
     */
    function _getPTPac(IPriceProvider priceProvider_) internal view returns (uint256) {
        (bytes32 price, bool has) = priceProvider_.peek();
        if (!has) revert InvalidPriceProvider(address(priceProvider_));
        return uint256(price);
    }

    // ------- Public Functions -------

    /**
     * @notice get amount of Collateral Asset locked by Pegged Token
     * @return lckAC [PREC]
     */
    function getLckAC() public view returns (uint256 lckAC) {
        uint256[] memory nTPArray = nTP;
        IPriceProvider[] memory tpPriceProviderArray = tpPriceProvider;
        for (uint8 i = 0; i < nTPArray.length; i = unchecked_inc(i)) {
            // [PREC] = [N] * [PREC]
            lckAC += nTPArray[i] * _getPTPac(tpPriceProviderArray[i]);
        }
    }

    /**
     * @notice get Collateral Token price
     * @param lckAC_ amount of Collateral Asset locked by Pegged Token [PREC]
     * @return pTCac [PREC]
     */
    function getPTCac(uint256 lckAC_) public view returns (uint256 pTCac) {
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
    function getCglb(uint256 lckAC_) public view returns (uint256 cglob) {
        if (lckAC_ == 0) return UINT256_MAX;
        // [PREC] = ([N] + [N]) * [PREC]
        cglob = (nACcb + nACioucb) * PRECISION;
        // [PREC] = [PREC] * [PREC] / [PREC]
        cglob = (cglob * PRECISION) / lckAC_;
    }
}
