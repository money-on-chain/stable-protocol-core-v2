pragma solidity ^0.8.16;

import "hardhat/console.sol";
import "../tokens/MocRC20.sol";
import "../interfaces/IMocRC20.sol";
import "./MocBaseBucket.sol";

/**
 * @title MocEma: Exponential Moving Average
 * @notice Moc Ema, provides a set of methods that allos to calculate and track
 * Exponential Moving Average for each of the pegged Tokens.
 * @dev More information of EMA calculation https://en.wikipedia.org/wiki/Exponential_smoothing
 */
// solhint-disable-next-line no-empty-blocks
abstract contract MocEma is MocBaseBucket {
    // ------- Events -------
    event TPemaUpdated(uint8 indexed i_, uint256 oldTPema_, uint256 newTPema_);

    // ------- Structs -------
    struct EmaItem {
        // exponential moving average
        uint256 ema;
        // smoothing factor
        uint256 sf;
    }

    // ------- Storage -------
    // TP EMA items
    EmaItem[] internal tpEma;

    // ------- Public Functions -------

    /**
     * @notice get target coverage adjusted by the moving average of the value of a Pegged Token
     * @param i_ Pegged Token index
     * @param pTPac_ Pegged Token price [PREC]
     * @return ctargemaTP [PREC]
     */
    function getCtargemaTP(uint8 i_, uint256 pTPac_) public view returns (uint256 ctargemaTP) {
        uint256 ema = tpEma[i_].ema;
        if (pTPac_ >= ema) return ctarg;
        // [PREC] = [PREC] * [PREC] / [PREC]
        return (ctarg * ema) / pTPac_;
    }

    /**
     * @notice get target coverage adjusted by the moving average of the value of the Collateral Asset
     * @return ctargemaCA [PREC]
     */
    function getCtargemaCA() public view returns (uint256 ctargemaCA) {
        uint256 num;
        uint256 den;
        uint256 pegAmount = pegContainer.length;
        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            uint256 nTP = pegContainer[i].nTP;
            num += nTP * tpEma[i].ema;
            den += nTP * _getPTPac(i);
        }
        if (den >= num || den == 0) return ctarg;
        return (ctarg * num) / den;
    }

    /**
     * @notice update exponential moving average of the value of a Pegged Token
     * @dev more information of EMA calculation https://en.wikipedia.org/wiki/Exponential_smoothing
     * @param i_ Pegged Token index
     */
    function updateTPema(uint8 i_) public {
        EmaItem memory currentTPema = tpEma[i_];
        uint256 pTPac = _getPTPac(i_);
        // [PREC] = [PREC] * [PREC] / ([PREC] - [PREC])
        uint256 term1 = (PRECISION * currentTPema.ema) / (ONE - currentTPema.sf);
        // [PREC] = [PREC] * [PREC] / [PREC]
        uint256 term2 = (PRECISION * currentTPema.sf) / pTPac;
        // [PREC] = [PREC] + [PREC]
        uint256 newEma = term1 + term2;
        tpEma[i_].ema = newEma;
        emit TPemaUpdated(i_, tpEma[i_].ema, newEma);
    }
}
