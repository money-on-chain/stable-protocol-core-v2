// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { MocVendors } from "../vendors/MocVendors.sol";
import { MocEma } from "./MocEma.sol";
import { IDataProvider } from "../interfaces/IDataProvider.sol";
import { SignedMath } from "@openzeppelin/contracts/utils/math/SignedMath.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

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
//            |
//            |
//    +-----------------+
//    |  MocOperations  |
//    +-----------------+
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

    struct MintTCandTPParams {
        address tp;
        uint256 qTP;
        uint256 qACmax;
        address sender;
        address recipient;
        address vendor;
    }

    struct RedeemTCandTPParams {
        address tp;
        uint256 qTC;
        uint256 qTP;
        uint256 qACmin;
        address sender;
        address recipient;
        address vendor;
    }

    struct SwapTPforTPParams {
        address tpFrom;
        address tpTo;
        uint256 qTP;
        uint256 qTPmin;
        uint256 qACmax;
        address sender;
        address recipient;
        address vendor;
    }

    struct SwapTPforTCParams {
        address tp;
        uint256 qTP;
        uint256 qTCmin;
        uint256 qACmax;
        address sender;
        address recipient;
        address vendor;
    }

    struct SwapTCforTPParams {
        address tp;
        uint256 qTC;
        uint256 qTPmin;
        uint256 qACmax;
        address sender;
        address recipient;
        address vendor;
    }

    struct RedeemTPParams {
        address tp;
        uint256 qTP;
        uint256 qACmin;
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
    error MissingProviderData(address dataProviderAddress_);
    error MaxFluxCapacitorOperationReached(uint256 max_, uint256 new_);
    error InvalidFluxCapacitorOperation();
    error InsufficientQtpSent(uint256 qTPsent_, uint256 qTPNeeded_);
    error QacBelowMinimumRequired(uint256 qACmin_, uint256 qACtoRedeem_);

    // ------- Events -------

    event LiqTPRedeemed(
        address indexed tp_,
        address indexed sender_,
        address indexed recipient_,
        uint256 qTP_,
        uint256 qAC_
    );
    event PeggedTokenChange(uint256 i_, PeggedTokenParams peggedTokenParams_);

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
        uint256 qACmarked = 0;
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
                feeCalcs.qFeeToken = _mulPrec(qAC_ * qACFeePct_, feeTokenPct) / feeTokenPrice;
                if (qACmarked > 0) {
                    // [N] = [N] * [PREC] / [PREC]
                    feeCalcs.qFeeTokenVendorMarkup = qACmarked / feeTokenPrice;
                    // [N] = [N] + [N]
                    qFeeTokenTotalNeeded = feeCalcs.qFeeToken + feeCalcs.qFeeTokenVendorMarkup;
                } else {
                    qFeeTokenTotalNeeded = feeCalcs.qFeeToken;
                }
                if (senderAllowance < qFeeTokenTotalNeeded || feeToken.balanceOf(sender_) < qFeeTokenTotalNeeded) {
                    feeCalcs.qFeeToken = 0;
                    feeCalcs.qFeeTokenVendorMarkup = 0;
                    qFeeTokenTotalNeeded = 0;
                }
            }
        }
        // if sender hasn't got enough feeToken balance or allowance or price provider hasn't got a valid price
        // then qFeeToken == 0 and sender pays fees with AC
        // slither-disable-next-line incorrect-equality
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
     * @notice ask to oracles for flux capacitor settings
     * @return absolute maximum transaction allowed for a certain number of blocks
     * @return differential maximum transaction allowed for a certain number of blocks
     */
    function _peekFluxCapacitorSettings() internal view returns (uint256, uint256) {
        bytes32 maxAbsoluteOp;
        bytes32 maxOpDiff;
        bool has;
        // get max absolute operation
        IDataProvider dataProvider = maxAbsoluteOpProvider;
        (maxAbsoluteOp, has) = dataProvider.peek();
        if (!has) revert MissingProviderData(address(dataProvider));
        // get max operational difference
        dataProvider = maxOpDiffProvider;
        (maxOpDiff, has) = dataProvider.peek();
        if (!has) revert MissingProviderData(address(dataProvider));
        return (uint256(maxAbsoluteOp), uint256(maxOpDiff));
    }

    /**
     * @notice returns lineal decay factor
     * @param blocksAmount_ amount of blocks to ask for the decay
     * @return newAbsoluteAccumulator absolute accumulator updated by lineal decay factor [N]
     * @return newDifferentialAccumulator differential accumulator updated by lineal decay factor [N]
     */
    function _calcAccWithDecayFactor(
        uint256 blocksAmount_
    ) internal view returns (uint256 newAbsoluteAccumulator, int256 newDifferentialAccumulator) {
        unchecked {
            // [N] = [N] - [N]
            uint256 blocksElapsed = block.number + blocksAmount_ - lastOperationBlockNumber;
            // [PREC] = [N] * [PREC] / [N]
            uint256 blocksRatio = (blocksElapsed * PRECISION) / decayBlockSpan;
            if (blocksRatio >= ONE) return (0, 0);
            uint256 decayFactor = ONE - blocksRatio;
            // [N] = [N] * [PREC] / [PREC]
            newAbsoluteAccumulator = (absoluteAccumulator * decayFactor) / PRECISION;
            // [N] = [N] * [PREC] / [PREC]
            newDifferentialAccumulator = (differentialAccumulator * int256(decayFactor)) / int256(PRECISION);
            return (newAbsoluteAccumulator, newDifferentialAccumulator);
        }
    }

    /**
     * @notice common function used to update accumulators during a TP operation
     *  reverts if not allowed
     * @dev the only difference between a redeem and a mint operation is that in the first one,
     * the qAC is subtracted on newDifferentialAccumulator instead of added
     * @param qAC_ amount of Collateral Asset used to mint
     * @param redeemFlag_ true if it is a redeem TP operation
     */
    function _updateAccumulators(uint256 qAC_, bool redeemFlag_) internal {
        (uint256 maxAbsoluteOperation, uint256 maxOperationalDifference) = _peekFluxCapacitorSettings();
        (uint256 newAbsoluteAccumulator, int256 newDifferentialAccumulator) = _calcAccWithDecayFactor(0);
        unchecked {
            newAbsoluteAccumulator += qAC_;
            int256 qACInt = int256(qAC_);
            if (redeemFlag_) qACInt = -qACInt;
            newDifferentialAccumulator += qACInt;
            // cannot underflow, always newDifferentialAccumulator <= newAbsoluteAccumulator
            uint256 operationalDifference = newAbsoluteAccumulator - SignedMath.abs(newDifferentialAccumulator);
            if (newAbsoluteAccumulator > maxAbsoluteOperation) {
                if (qAC_ > maxAbsoluteOperation) revert InvalidFluxCapacitorOperation();
                revert MaxFluxCapacitorOperationReached(maxAbsoluteOperation, newAbsoluteAccumulator);
            }
            if (operationalDifference > maxOperationalDifference)
                revert MaxFluxCapacitorOperationReached(maxOperationalDifference, operationalDifference);
            // update storage
            absoluteAccumulator = newAbsoluteAccumulator;
            differentialAccumulator = newDifferentialAccumulator;
            lastOperationBlockNumber = block.number;
        }
    }

    /**
     * @notice update accumulators during a mint TP operation
     *  reverts if not allowed
     * @param qAC_ amount of Collateral Asset used to mint
     */
    function _updateAccumulatorsOnMintTP(uint256 qAC_) internal {
        _updateAccumulators(qAC_, false);
    }

    /**
     * @notice update accumulators during a redeem operation
     *  reverts if not allowed
     * @param qAC_ reserve amount used for redeem
     */
    function _updateAccumulatorsOnRedeemTP(uint256 qAC_) internal {
        _updateAccumulators(qAC_, true);
    }

    /**
     * @notice internal common function used to calc max AC allowed to mint or redeem TP
     *  due to accumulators
     * // TODO: move this function to a MocView contract
     * @param newAbsoluteAccumulator_ absolute accumulator updated by lineal decay factor [N]
     * @param a_ on mint = AA - DA ; on redeem = AA + DA
     * @param b_ on mint = AA + DA ; on redeem = AA - DA
     * @return maxQAC minimum regarding maxAbsoluteOperation and maxOperationalDifference
     */
    function _calcMaxQACToOperateTP(
        uint256 newAbsoluteAccumulator_,
        uint256 a_,
        uint256 b_
    ) internal view returns (uint256 maxQAC) {
        (uint256 maxAbsoluteOperation, uint256 maxOperationalDifference) = _peekFluxCapacitorSettings();
        if (newAbsoluteAccumulator_ >= maxAbsoluteOperation) return 0;
        uint256 absoluteAccAllowed = maxAbsoluteOperation - newAbsoluteAccumulator_;

        if (a_ <= maxOperationalDifference) return absoluteAccAllowed;
        if (b_ >= maxOperationalDifference) return 0;
        uint256 differentialAccAllowed = (maxOperationalDifference - b_) / 2;
        return Math.min(absoluteAccAllowed, differentialAccAllowed);
    }

    /**
     * @notice gets the max amount of AC allowed to operate to mint TP with, restricted by accumulators
     * // TODO: move this function to a MocView contract
     * @return maxQAC minimum regarding maxAbsoluteOperation and maxOperationalDifference
     */
    function maxQACToMintTP() external view returns (uint256 maxQAC) {
        (uint256 newAbsoluteAccumulator, int256 newDifferentialAccumulator) = _calcAccWithDecayFactor(1);
        // X = mint amount
        // (AA + X) - |DA + X| <= MODA && X >= 0
        // 1) if DA + X >= 0 ---> AA + X - DA - X <= MODA ---> AA - DA <= MODA
        // 2) if DA + X < 0 ---> X <= (MODA - (AA + DA)) / 2

        // AA >= |DA|
        uint256 a = uint256(int256(newAbsoluteAccumulator) - newDifferentialAccumulator);
        uint256 b = uint256(int256(newAbsoluteAccumulator) + newDifferentialAccumulator);
        return _calcMaxQACToOperateTP(newAbsoluteAccumulator, a, b);
    }

    /**
     * @notice gets the max amount of AC allowed to operate to redeem TP with, restricted by accumulators
     * // TODO: move this function to a MocView contract
     * @return maxQAC minimum regarding maxAbsoluteOperation and maxOperationalDifference
     */
    function maxQACToRedeemTP() external view returns (uint256 maxQAC) {
        (uint256 newAbsoluteAccumulator, int256 newDifferentialAccumulator) = _calcAccWithDecayFactor(1);
        // X = redeem amount
        // (AA + X) - |DA - X| <= MODA && X >= 0
        // 1) if DA - X < 0 ---> AA + X + DA - X <= MODA ---> AA + DA <= MODA
        // 2) if DA - X >= 0 ---> X <= (MODA - (AA - DA)) / 2

        // AA >= |DA|
        uint256 a = uint256(int256(newAbsoluteAccumulator) + newDifferentialAccumulator);
        uint256 b = uint256(int256(newAbsoluteAccumulator) - newDifferentialAccumulator);
        return _calcMaxQACToOperateTP(newAbsoluteAccumulator, a, b);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */

    // Purposely left unused to save some state space to allow for future upgrades
    // slither-disable-next-line unused-state
    uint256[50] private __gap;
}
