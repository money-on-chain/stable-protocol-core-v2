// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { MocVendors } from "../vendors/MocVendors.sol";
import { MocEma } from "./MocEma.sol";

// ------- External Structs -------

struct PeggedTokenParams {
    // Pegged Token contract address to add
    address tpTokenAddress;
    // priceProviderAddress Pegged Token price provider contract address
    address priceProviderAddress;
    // Pegged Token target coverage [PREC]
    uint256 tpCtarg;
    // additional fee pct applied on mint [PREC]
    uint256 tpMintFee;
    // additional fee pct applied on redeem [PREC]
    uint256 tpRedeemFee;
    // initial Pegged Token exponential moving average [PREC]
    uint256 tpEma;
    // Pegged Token smoothing factor [PREC]
    uint256 tpEmaSf;
}

//    +-----------------+
//    |  MocBaseBucket  |
//    +-----------------+
//            ^
//            | is
//            |
//    +-----------------+
//    |    MocEma       |
//    +-----------------+
//            ^
//            | is
//            |
//    +-----------------+ contains  +-----------------+
//    |    MocCommons   | ------>   |    MocVendors   |
//    +-----------------+           +-----------------+
//            ^
//            | is
//            | _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
//            |                              |
//    +-----------------+ contains  +-----------------+
//    |     MocCore     | ------>   |MocCoreExpansion |
//    +-----------------+           +-----------------+
//            ^
//            | is
//            | _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
//            |                              |
//    +-----------------+           +-----------------+
//    |  MocCACoinbase  |           |    MocCARC20    |
//    +-----------------+           +-----------------+
/**
 * @title MocCommons
 * @dev To bypass the 24kb size limitation on MocCore we use MocCoreExpansion contract. Some functions
 *  are implemented there and MocCore delegates calls to it. To achieve that, we need both to have the
 *  exact same storage layout and be able to access the same common functions.
 *  MocCommons contract serves as the last shared ancestor in the line of inheritance for them,
 *  and all storage variables must be either declared here or in a parent contract.
 *  Declaring variables after this point could result in storage collisions.
 */
abstract contract MocCommons is MocEma {
    // ------- Storage -------

    // Address for MocVendors contract, provides fee markup information
    MocVendors public mocVendors;

    // ------- Internal Structs -------

    struct SwapTPforTPParams {
        uint256 iFrom;
        uint256 iTo;
        uint256 qTP;
        uint256 qTPmin;
        uint256 qACmax;
        address sender;
        address recipient;
        address vendor;
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

    struct SwapTCforTPParams {
        uint256 i;
        uint256 qTC;
        uint256 qTPmin;
        uint256 qACmax;
        address sender;
        address recipient;
        address vendor;
    }

    struct FeeCalcs {
        uint256 qACFee;
        uint256 qFeeToken;
        uint256 qACVendorMarkup;
        uint256 qFeeTokenVendorMarkup;
    }

    // ------- Custom Errors -------

    error PeggedTokenAlreadyAdded();
    error InsufficientTPtoRedeem(uint256 qTP_, uint256 tpAvailableToRedeem_);
    error TransferFailed();
    error OnlyWhenLiquidated();
    error InsufficientQacSent(uint256 qACsent_, uint256 qACNeeded_);
    error InsufficientTPtoMint(uint256 qTP_, uint256 tpAvailableToMint_);
    error QtpBelowMinimumRequired(uint256 qTPmin_, uint256 qTP_);
    error QtcBelowMinimumRequired(uint256 qTCmin_, uint256 qTC_);
    error QacNeededMustBeGreaterThanZero();
    error InsufficientTCtoRedeem(uint256 qTC_, uint256 tcAvailableToRedeem_);

    // ------- Events -------

    event TPRedeemed(
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
    event PeggedTokenChange(uint256 indexed i_, PeggedTokenParams peggedTokenParams_);
    event TPSwappedForTP(
        uint256 indexed iFrom_,
        uint256 iTo_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTPfrom_,
        uint256 qTPto_,
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

    // ------- Initializer -------

    /**
     * @notice contract initializer
     * @param mocVendors_ address for MocVendors contract.
     */
    function __MocCommons_init_unchained(address mocVendors_) internal onlyInitializing {
        mocVendors = MocVendors(mocVendors_);
    }

    // ------- Internal Functions -------

    /**
     * @notice calc fees amount in qAC or Fee Token
     *  If `sender_` has enough Fee Token to pay fees, will be used. In another case will use qAC
     * @dev if qFeeToken > 0, qACFee = 0. If qACFee > 0, qFeeToken = 0.
     * @param sender_ address who executes the operation
     * @param qAC_ amount of AC involved in the operation, could be sent form sender for mint or
     *  sent to recipient for redeem [N]
     * @param qACFeePct_ additional fee pct applied on operation
     * @return qACSurcharges amount of AC needed to pay fees and markup. 0 if pays with Fee Token
     * @return qFeeTokenTotalNeeded amount of Fee Token needed to pay fees and markup. 0 if pays with AC
     * @return feeCalcs
     * @dev
     *      qACFee amount of AC needed to pay fees
     *      qFeeToken amount of Fee Token needed to pay fess
     *      qACVendorMarkup amount of AC needed to pay vendor markup
     *      qFeeTokenVendorMarkup amount of Fee Token needed to pay vendor markup
     */
    function _calcFees(
        address sender_,
        address vendor_,
        uint256 qAC_,
        uint256 qACFeePct_
    ) internal view returns (uint256 qACSurcharges, uint256 qFeeTokenTotalNeeded, FeeCalcs memory feeCalcs) {
        uint256 qACmarked;
        if (vendor_ != address(0)) {
            // [PREC] = [N] * [PREC]
            qACmarked = qAC_ * mocVendors.vendorMarkup(vendor_);
        }
        uint256 senderAllowance = feeToken.allowance(sender_, address(this));
        if (senderAllowance > 0) {
            (uint256 feeTokenPrice, bool hasFeeTokenPrice) = _peekPrice(feeTokenPriceProvider);
            if (hasFeeTokenPrice) {
                // calculates Fee Token to be charged as fee
                // [N] = ([N] * [PREC] * [PREC] / [PREC]) / [PREC]
                // TODO: define if will not be necessary a feeTokenPct for each operation
                feeCalcs.qFeeToken = _mulPrec(qAC_ * qACFeePct_, feeTokenPct) / feeTokenPrice;
                if (qACmarked > 0) {
                    // [N] = [N] * [PREC] / [PREC]
                    feeCalcs.qFeeTokenVendorMarkup = qACmarked / feeTokenPrice;
                    // [N] = [N] + [N]
                    qFeeTokenTotalNeeded = feeCalcs.qFeeToken + feeCalcs.qFeeTokenVendorMarkup;
                } else {
                    qFeeTokenTotalNeeded = feeCalcs.qFeeToken;
                }
                // TODO: if feeTokenPct == 0 should use qAC too?
                if (senderAllowance < qFeeTokenTotalNeeded || feeToken.balanceOf(sender_) < qFeeTokenTotalNeeded) {
                    feeCalcs.qFeeToken = 0;
                    feeCalcs.qFeeTokenVendorMarkup = 0;
                    qFeeTokenTotalNeeded = 0;
                }
            }
        }
        // if sender hasn't got enough feeToken balance or allowance or price provider hasn't got a valid price
        // then qFeeToken == 0 and sender pays fees with AC
        if (feeCalcs.qFeeToken == 0) {
            // calculates qAC to be charged as fee
            // [N] = [N] * [PREC] / [PREC]
            feeCalcs.qACFee = _mulPrec(qAC_, qACFeePct_);
            if (qACmarked > 0) {
                // [N] = [PREC] / [PREC]
                feeCalcs.qACVendorMarkup = qACmarked / PRECISION;
                // [N] = [N] + [N]
                qACSurcharges = feeCalcs.qACFee + feeCalcs.qACVendorMarkup;
            } else {
                qACSurcharges = feeCalcs.qACFee;
            }
        }
        return (qACSurcharges, qFeeTokenTotalNeeded, feeCalcs);
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
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
