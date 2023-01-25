// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import "./MocStorage.sol";

/**
 * @title MocCoreExpansion
 * @notice This contract is used as an expansion of MocCore because 24kb size limitation
 *  MocCore delegate some function calls to it.
 * @dev IMPORTANT NOTES:
 *  1. MocCore and MocCoreExpansion must have always the same storage layout to avoid collisions
 *  2. Because MocCore is upgradeable and delegates calls to MocCoreExpansion, it cannot be upgradeable because
 *      a proxy contract cannot delegate calls to another proxy contract. So, for any MocCoreExpansion upgrade
 *      you must deploy a new implementation and set it to MocCore.
 */
contract MocCoreExpansion is MocStorage {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice add a Pegged Token to the protocol
     * @dev Note that the ema value, should consider `nextEmaCalculation`
     *  This function is called by MocCore contract using it's context with delegate call
     *  Checks done there:
     *  -  onlyAuthorizedChanger: the caller must have governance authorization.
     * @param peggedTokenParams_ params of Pegged Token to add
     * @dev tpTokenAddress Pegged Token contract address to add
     *      priceProviderAddress Pegged Token price provider contract address
     *      tpCtarg Pegged Token target coverage [PREC]
     *      tpMintFee additional fee pct applied on mint [PREC]
     *      tpRedeemFee additional fee pct applied on redeem [PREC]
     *      tpEma initial Pegged Token exponential moving average [PREC]
     *      tpEmaSf Pegged Token smoothing factor [PREC]
     *
     *  Requirements:
     *
     *  - tpTokenAddress must be a MocRC20, with mint, burn roles already settled
     *  for this contract
     */
    function addPeggedToken(PeggedTokenParams calldata peggedTokenParams_) external {
        IMocRC20 tpToken = IMocRC20(peggedTokenParams_.tpTokenAddress);
        // Verifies it has the right roles over this TP
        if (!tpToken.hasFullRoles(address(this))) revert InvalidAddress();

        IPriceProvider priceProvider = IPriceProvider(peggedTokenParams_.priceProviderAddress);
        if (peggedTokenIndex[address(tpToken)].exists) revert PeggedTokenAlreadyAdded();
        uint256 newTPindex = uint256(tpTokens.length);
        peggedTokenIndex[address(tpToken)] = PeggedTokenIndex({ index: newTPindex, exists: true });

        // set Pegged Token address
        tpTokens.push(tpToken);
        // set peg container item
        pegContainer.push(PegContainerItem({ nTP: 0, priceProvider: priceProvider }));
        // set target coverage
        tpCtarg.push(peggedTokenParams_.tpCtarg);
        // set mint fee pct
        tpMintFee.push(peggedTokenParams_.tpMintFee);
        // set redeem fee pct
        tpRedeemFee.push(peggedTokenParams_.tpRedeemFee);
        // set EMA initial value and smoothing factor
        tpEma.push(EmaItem({ ema: peggedTokenParams_.tpEma, sf: peggedTokenParams_.tpEmaSf }));
        tpiou.push();
        // reverts if price provider is invalid
        pACtpLstop.push(getPACtp(newTPindex));
        // emit the event
        emit PeggedTokenChange(newTPindex, peggedTokenParams_);
    }

    /**
     * @notice modifies a Pegged Token of the protocol
     * @dev Note that the ema value, should consider `nextEmaCalculation`
     *  This function is called by MocCore contract using it's context with delegate call
     *  Checks done there:
     *  -  onlyAuthorizedChanger: the caller must have governance authorization.
     * @param peggedTokenParams_ params of Pegged Token to add
     * @dev tpTokenAddress Pegged Token contract address to identify the token to edit
     *      priceProviderAddress Pegged Token price provider contract address
     *      tpCtarg Pegged Token target coverage [PREC]
     *      tpMintFee additional fee pct applied on mint [PREC]
     *      tpRedeemFee additional fee pct applied on redeem [PREC]
     *      tpEma initial Pegged Token exponential moving average [PREC]
     *      tpEmaSf Pegged Token smoothing factor [PREC]
     *
     *  Requirements:
     *
     * - the tpTokenAddress must exists
     */
    function editPeggedToken(PeggedTokenParams calldata peggedTokenParams_) external {
        PeggedTokenIndex memory ptIndex = peggedTokenIndex[peggedTokenParams_.tpTokenAddress];
        if (!ptIndex.exists) revert InvalidAddress();
        uint256 i = ptIndex.index;
        // if being edited, verifies it is a valid priceProvider
        if (peggedTokenParams_.priceProviderAddress != address(pegContainer[i].priceProvider)) {
            IPriceProvider priceProvider = IPriceProvider(peggedTokenParams_.priceProviderAddress);
            (, bool has) = priceProvider.peek();
            if (!has) revert InvalidAddress();
            pegContainer[i].priceProvider = priceProvider;
        }
        // set target coverage
        tpCtarg[i] = peggedTokenParams_.tpCtarg;
        // set mint fee pct
        tpMintFee[i] = peggedTokenParams_.tpMintFee;
        // set redeem fee pct
        tpRedeemFee[i] = peggedTokenParams_.tpRedeemFee;
        // set EMA initial value and smoothing factor
        tpEma[i].sf = peggedTokenParams_.tpEmaSf;
        // emit the event
        emit PeggedTokenChange(i, peggedTokenParams_);
    }

    /**
     * @notice Allow redeem on liquidation state, user Peg balance gets burned
     * @dev This function is called by MocCore contract using it's context with delegate call
     *  The equivalent AC given the liquidation frozen price(qACRedeemed) is transferred
     *  to the `recipient_` by MocCore contract
     *  Checks done there:
     *  -  notPaused: the contract must be unpaused
     * @param i_ Pegged Token index
     * @param sender_ address owner of the TP to be redeemed
     * @param recipient_ address who receives the AC
     * @return qACRedeemed amount of AC sent to `recipient_`
     */
    function liqRedeemTPTo(
        uint256 i_,
        address sender_,
        address recipient_,
        uint256 mocACBalance
    ) external returns (uint256 qACRedeemed) {
        if (!liquidated) revert OnlyWhenLiquidated();
        uint256 qTP = tpTokens[i_].balanceOf(sender_);
        if (qTP == 0) revert InsufficientTPtoRedeem(qTP, qTP);
        // [PREC]
        uint256 liqPACtp = tpLiqPrices[i_];
        // [PREC] = [N] * [PREC] / [PREC]
        qACRedeemed = _divPrec(qTP, liqPACtp);
        // Given rounding errors, the last redeemer might receive a little less
        if (mocACBalance < qACRedeemed) qACRedeemed = mocACBalance;
        emit TPRedeemed(i_, sender_, recipient_, qTP, qACRedeemed, 0, 0);
        // burn qTP from the sender
        tpTokens[i_].burn(sender_, qTP);
    }
}
