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
        // actual interest rate for Pegged Token [PREC]
        uint256 tils;
        // minimum interest rate that can be charged [PREC]
        uint256 tiMin;
        // maximum interest rate that can be charged [PREC]
        uint256 tiMax;
    }
    struct FACitem {
        // abundance of Pegged Token where it is desired that the model stabilizes [PREC]
        int256 abeq;
        // minimum correction factor sub ONE [PREC]
        int256 facMinSubOne;
        // maximum correction factor [PREC]
        int256 facMax;
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
    function _calcTPinterestRate(
        uint8 i_,
        uint256 qTP_,
        uint256 tpAvailableToRedeem,
        uint256 nTP_
    ) internal view returns (uint256 interestRate) {
        // get the number of blocks remaining for settlement
        uint256 bts = mocSettlement.getBts();
        // check if it is within the block limit to charge interest
        if (bts > tpBmin[i_]) {
            // get the initial abundance of TPi
            // [PREC]
            uint256 arb = _getArb(tpAvailableToRedeem, nTP_);
            // get the final abundance of TPi
            // [PREC]
            uint256 arf = _getArf(tpAvailableToRedeem, nTP_, qTP_);
            // calculate the initial correction factor
            // [PREC]
            uint256 fctb = _calcFAC(i_, arb);
            // calculate the final correction factor
            // [PREC]
            uint256 fctf = _calcFAC(i_, arf);
            // calculate the average correction factor
            // [PREC] = [PREC] + [PREC] / [N]
            uint256 fctAvg = (fctb + fctf) / 2;
            // calculate the interest rate using the correction factor
            // [PREC] = ([PREC] * [PREC]) / [PREC]
            interestRate = (tpInterestRate[i_].tils * fctAvg) / PRECISION;
            // calculate the proportional part until the settlement
            // [PREC] = ([PREC] * [N]) / [N]
            interestRate = (interestRate * bts) / mocSettlement.bes();
        }
        return interestRate;
    }

    /**
     * @notice calculate correction factor for interest rate
     *      FAC
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
     * @param i_ Pegged Token index
     * @param abri_ instantaneous relative abundance of Pegged Token
     * @return fac [PREC]
     */
    function _calcFAC(uint8 i_, uint256 abri_) internal view returns (uint256) {
        FACitem memory fac = tpFAC[i_];
        int256 abri = int256(abri_);
        int256 aNum;
        int256 aDen;
        int256 b;
        // it is the line nª1
        if (abri < fac.abeq) {
            // [PREC] = [PREC] - [PREC]
            aNum = (int256(ONE) - fac.facMax);
            // [PREC]
            aDen = fac.abeq;
            // [PREC]
            b = fac.facMax;
        }
        // it is the line nª2
        else {
            // [PREC] = [PREC]
            aNum = fac.facMinSubOne;
            // [PREC] = [PREC] - [PREC]
            aDen = int256(ONE) - fac.abeq;
            // [PREC] = [PREC] - (([PREC] * [PREC]) / [PREC])
            b = int256(ONE) - ((fac.abeq * aNum) / aDen);
        }
        // [PREC] = (([PREC] * [PREC]) / [PREC]) + [PREC]
        return uint256(((abri * aNum) / aDen) + b);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
