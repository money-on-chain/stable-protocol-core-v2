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
        uint256 tils;
        uint256 tiMin;
        uint256 tiMax;
    }
    struct FACitem {
        uint256 abeq;
        uint256 facMin;
        uint256 facMax;
    }
    // ------- Storage -------
    InterestRateItem[] internal tpInterestRate;
    FACitem[] internal tpFAC;
    uint256[] internal bMin;
    MocSettlement internal mocSettlement;

    // ------- Initializer -------
    /**
     * @notice contract initializer
     */
    /* solhint-disable-next-line no-empty-blocks */
    function __MocInterestRate_init_unchained() internal onlyInitializing {}

    // ------- Internal Functions -------

    /**
     * @notice calculate interest rate for redeem Pegged Token
     * @param i_ Pegged Token index
     * @param qTP_ amount of Pegged Token to redeem
     * @return interestRate [PREC]
     */
    function _calcTPinterestRate(uint8 i_, uint256 qTP_) internal view returns (uint256 interestRate) {
        uint256 bts = mocSettlement.getBts();
        // establece si está dentro del límite de bloques para cobrar interés
        if (bts > bMin[i_]) {
            // calcula la abundancia inicial de TPi
            uint256 arb = _getArb(i_);
            // calcula la abundancia final de TPi
            uint256 arf = _getArf(i_, qTP_);
            // calcula el factor de corrección de tasa inicial
            uint256 fctb = _calcFAC(i_, arb);
            // calcula el factor de corrección de tasa final
            uint256 fctf = _calcFAC(i_, arf);
            // calcula el factor de corrección de tasa promedios
            uint256 fctavg = fctb + fctf / 2;
            // calcula la tasa de interés teniendo en cuenta esos factores
            interestRate = tpInterestRate[i_].tils * fctavg;
            // calcula la parte proporcional hasta el settlement
            interestRate = (interestRate * bts) / mocSettlement.bes();
        }
        return interestRate;
    }

    function _calcFAC(uint8 i, uint256 arbi) internal view returns (uint256) {
        //TODO: agregar decimales a estos parametros
        int256 _abeq = int256(tpFAC[i].abeq);
        int256 _fACmin = int256(tpFAC[i].facMin);
        int256 _fACmax = int256(tpFAC[i].facMax);
        int256 _arbi = int256(arbi);
        // determina en cuál de las rectas está
        if (_arbi >= _abeq) {
            int256 a2num = (_fACmin - int256(ONE));
            int256 a2den = (int256(ONE) - _abeq);
            int256 b2 = int256(ONE) - ((_abeq * a2num) / a2den);
            return uint256((((_arbi * a2num) / a2den) + b2));
        } else {
            int256 a1num = (int256(ONE) - _fACmax);
            int256 a1den = _abeq;
            int256 b1 = _fACmax;
            return uint256((((_arbi * a1num) / a1den) + b1));
        }
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
