pragma solidity ^0.8.16;

import "./MocBaseBucket.sol";
import "../MocSettlement.sol";

/**
 * @title MocInterestRate
 * @notice MocInterestRate, provides a set of methods that allows to calculate the interest to be paid
 *  when Pegged Token are redeemed. The interest rate is adjusted in each settlement
 */

abstract contract MocInterestRate is MocBaseBucket {
    // ------- Structs -------
    struct InterestRateItem {
        // actual interest rate for Pegged Token
        uint256 tils;
        // minimum interest rate that can be charged
        uint256 tiMin;
        // maximum interest rate that can be charged
        uint256 tiMax;
    }
    struct FACitem {
        // abundance of Pegged Token where it is desired that the model stabilizes
        uint256 abeq;
        // minimum correction factor
        uint256 facMin;
        // maximum correction factor
        uint256 facMax;
    }

    // ------- Storage -------
    // interest rate item for each Pegged Token
    InterestRateItem[] internal tpInterestRate;
    // correction factor item for each Pegged Token
    FACitem[] internal tpFAC;
    // minimum amount of blocks until the settlement to charge interest for the redemption of Pegged Token
    uint256[] internal tpBmin;
    // MocSettlement contract
    MocSettlement internal mocSettlement;

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param mocSettlementAddress_ MocSettlement contract address
     */
    function __MocInterestRate_init_unchained(address mocSettlementAddress_) internal onlyInitializing {
        if (mocSettlementAddress_ == address(0)) revert InvalidAddress();
        mocSettlement = MocSettlement(mocSettlementAddress_);
    }

    // ------- Internal Functions -------

    /**
     * @notice calculate interest rate for redeem Pegged Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to redeem
     * @return interestRate [PREC]
     */
    function _calcTPinterestRate(uint8 i_, uint256 qTP_) internal view returns (uint256 interestRate) {
        // get the number of blocks remaining for settlement
        uint256 bts = mocSettlement.getBts();
        // check if it is within the block limit to charge interest
        if (bts > tpBmin[i_]) {
            // get the initial abundance of TPi
            // [PREC]
            uint256 arb = _getArb(i_);
            // get the final abundance of TPi
            // [PREC]
            uint256 arf = _getArf(i_, qTP_);
            // calculate the initial correction factor
            // [PREC]
            uint256 fctb = _calcFAC(i_, arb);
            // calculate the final correction factor
            // [PREC]
            uint256 fctf = _calcFAC(i_, arf);
            // calculate the average correction factor
            // [PREC] = [PREC] + [PREC] / [N]
            uint256 fctavg = fctb + fctf / 2;
            // calculate the interest rate using the correction factor
            // [PREC] = [PREC] * [PREC] / [PREC]
            interestRate = (tpInterestRate[i_].tils * fctavg) / PRECISION;
            // calculate the proportional part until the settlement
            // [PREC] = [PREC] * [N] / [N]
            interestRate = (interestRate * bts) / mocSettlement.bes();
        }
        return interestRate;
    }

    /**
     * @notice calculate correction factor for interest rate
     * @param i_ Pegged Token index
     * @param abri_ instantaneous relative abundance of Pegged Token
     * @return fac [PREC]
     */
    function _calcFAC(uint8 i_, uint256 abri_) internal view returns (uint256) {
        /**     FAC
         *       |
         * facMax--*
         *       |  *
         *      4--  *
         *       |    * <--------- line nª1
         *      3--    *
         *       |      *
         *      2--      *
         *       |        *
         *      1-- > > > >*
         *       |         ^  *
         *    .75--        ^     * <--------- line nª2
         *       |         ^         *
         *     .5--        ^             *
         *       |         ^                 *
         *    .25--        ^                     *
         *       |         ^                         *
         * facMin--> > > > ^ > > > > > > > > > > > > > > >*
         *       |         ^                              ^
         *       |----|----|-----|----|----|----|----|----|----| arbi
         *       0        abeq       .5        .75        1
         *
         * FAC(Abri)= a * Abri + b
         * The calculation of the correction factor consists of 2 sections of lines:
         * 1) A steeply sloping line from abundance 0 and a maximum factor (FACmax) to an inflection point
         *    where the factor is 1 and the abundance where you want the model to stabilize (Abeq).
         *    a1 = (1 - FACmax) / Abeq
         *    b1 = FACmax
         * 2) A line of less steep slope from the inflection point to abundance 1 and a minimum factor (FACmin).
         *    a2 = FACmin - 1 / 1 - Abeq
         *    b2 = 1 - (Abeq * a2)
         */

        FACitem memory fac = tpFAC[i_];
        int256 abeq = int256(fac.abeq);
        int256 fACmin = int256(fac.facMin);
        int256 fACmax = int256(fac.facMax);
        int256 abri = int256(abri_);
        int256 a;
        int256 b;
        // it is the line nª1
        if (abri < abeq) {
            // [N] = ([PREC] - [PREC]) / [PREC]
            a = (int256(ONE) - fACmax) / abeq;
            // [PREC]
            b = fACmax;
        }
        // it is the line nª2
        else {
            // [N] = ([PREC] - [PREC]) / ([PREC] - [PREC])
            a = (fACmin - int256(ONE)) / (int256(ONE) - abeq);
            // [PREC] = [PREC] - ([PREC] * [N])
            b = int256(ONE) - (abeq * a);
        }
        // [PREC] = ([PREC] * [N]) + [PREC]
        return uint256((abri * a) + b);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
