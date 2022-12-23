pragma solidity ^0.8.17;

import "../interfaces/IMocRC20.sol";
import "./MocBaseBucket.sol";

/**
 * @title MocEma: Exponential Moving Average
 * @notice Moc Ema, provides a set of methods that allows to calculate and track
 * Exponential Moving Average for each of the pegged Tokens.
 * @dev More information of EMA calculation https://en.wikipedia.org/wiki/Exponential_smoothing
 */
abstract contract MocEma is MocBaseBucket {
    // ------- Events -------
    event TPemaUpdated(uint256 indexed i_, uint256 oldTPema_, uint256 newTPema_);

    // ------- Structs -------
    struct EmaItem {
        // exponential moving average
        uint256 ema;
        // smoothing factor
        uint256 sf;
    }

    // ------- Storage -------
    // TP EMA items, indexes are in sync with PeggedTokens across Moc solution
    EmaItem[] public tpEma;
    // next Ema Calculation Block number
    uint256 public nextEmaCalculation;
    // amount of blocks to wait for next ema calculation
    uint256 public emaCalculationBlockSpan;

    /**
     * @notice calculates exponential moving average of the value of a Pegged Token
     * @dev more information of EMA calculation https://en.wikipedia.org/wiki/Exponential_smoothing
     * @param currentTPema_ current Ema value
     * @param pACtp_ current tp AC price
     */
    function __calcNewEma(EmaItem memory currentTPema_, uint256 pACtp_) private pure returns (uint256) {
        // [PREC²] = [PREC] * ([PREC] - [PREC])
        uint256 term1 = currentTPema_.ema * (ONE - currentTPema_.sf);
        // [PREC²] = [PREC] * [PREC]
        uint256 term2 = currentTPema_.sf * pACtp_;
        // [PREC] = ([PREC²] + [PREC²]) / [PREC]
        return (term1 + term2) / PRECISION;
    }

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param emaCalculationBlockSpan_ amount of blocks to wait between Pegged ema calculation
     */
    function __MocEma_init_unchained(uint256 emaCalculationBlockSpan_) internal onlyInitializing {
        if (emaCalculationBlockSpan_ == 0) revert InvalidValue();
        emaCalculationBlockSpan = emaCalculationBlockSpan_;
        _updateNextEmaCalculation(emaCalculationBlockSpan_);
    }

    // ------- Internal Functions -------

    /**
     * @notice updates next EMA block calculation
     * @param emaCalculationBlockSpan_ amount of blocks to wait between Pegged ema calculation
     */
    function _updateNextEmaCalculation(uint256 emaCalculationBlockSpan_) internal {
        unchecked {
            nextEmaCalculation = block.number + emaCalculationBlockSpan_;
        }
    }

    /**
     * @notice get target coverage adjusted by the moving average of the value of a Pegged Token
     * @param i_ Pegged Token index
     * @param pACtp_ Pegged Token price [PREC]
     * @return ctargemaTP [PREC]
     */
    function _getCtargemaTP(uint256 i_, uint256 pACtp_) internal view returns (uint256 ctargemaTP) {
        uint256 auxTPctarg = tpCtarg[i_];
        uint256 auxTpEma = tpEma[i_].ema;
        if (shouldCalculateEma()) auxTpEma = __calcNewEma(tpEma[i_], pACtp_);
        if (auxTpEma >= pACtp_) return auxTPctarg;
        // [PREC] = [PREC] * [PREC] / [PREC]
        return (auxTPctarg * pACtp_) / auxTpEma;
    }

    /**
     * @notice update exponential moving average of the value of a Pegged Token
     * @param i_ Pegged Token index
     */
    function updateTPema(uint256 i_) internal {
        EmaItem memory currentTPema = tpEma[i_];
        uint256 pACtp = getPACtp(i_);
        uint256 newEma = __calcNewEma(currentTPema, pACtp);
        // save new ema value to storage
        tpEma[i_].ema = newEma;
        emit TPemaUpdated(i_, currentTPema.ema, newEma);
    }

    /**
     * @notice calculates CA target coverage, adjusted by all Pegged Token's to
     *  Collateral Asset last stored moving average price
     * @dev WARN: if EMA are not up to date, the resulting coverage might not reflect real spot value
     *      qAC = (nTP + tpGain) / pACtp
     *      ctargemaCA = ∑(ctargemaTP * qAC) / ∑(qAC)
     * @return ctargemaCA [PREC]
     * @return pACtps array of all AC prices for each TP, with [PREC]
     */
    function _calcCtargemaCA() internal view returns (uint256 ctargemaCA, uint256[] memory pACtps) {
        uint256 num;
        uint256 den;
        uint256 pegAmount = pegContainer.length;
        pACtps = new uint256[](pegAmount);
        for (uint256 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            uint256 pACtp = getPACtp(i);
            pACtps[i] = pACtp;
            (uint256 tpGain, ) = _getPnLTP(i, pACtp);
            // [PREC] = [N] * [PREC] * [PREC]  / [PREC]
            uint256 qAC = _divPrec((pegContainer[i].nTP + tpGain) * PRECISION, pACtp);
            // [PREC]^2 = [PREC] * [PREC]
            num += _getCtargemaTP(i, pACtp) * qAC;
            // [PREC] = [PREC]
            den += qAC;
        }
        // we must return a default value when all nTP are 0
        if (den == 0) {
            unchecked {
                return (protThrld * 2, pACtps);
            }
        }
        // [PREC] = ([PREC]^2) / [PREC]
        ctargemaCA = num / den;
    }

    /**
     * @notice make sure Ema is up to date, and calculates target coverage adjusted by all Pegged Token's
     * to Collateral Asset rate moving average
     * @dev qAC = nTP / pACtp
     *      ctargemaCA = ∑(ctargemaTP * qAC) / ∑(qAC)
     * @return ctargemaCA [PREC]
     * @return pACtps array of all AC prices for each TP, with [PREC]
     */
    function _updateEmasAndCalcCtargemaCA() internal returns (uint256 ctargemaCA, uint256[] memory pACtps) {
        // Make sure EMAs are up to date for all the pegs, in the, unlikely, scenario they hadn't been updated already
        updateEmas();
        return _calcCtargemaCA();
    }

    // ------- Public Functions -------

    /**
     * @notice calculates target coverage adjusted by all Pegged Token's to Collateral Asset rate moving average
     * @dev qAC = nTP / pACtp
     *      ctargemaCA = ∑(ctargemaTP * qAC) / ∑(qAC)
     * @return ctargemaCA [PREC]
     */
    function calcCtargemaCA() external view returns (uint256 ctargemaCA) {
        (ctargemaCA, ) = _calcCtargemaCA();
    }

    /**
     * @notice true if the necessary span has pass since last ema update
     */
    function shouldCalculateEma() public view returns (bool) {
        unchecked {
            return block.number >= nextEmaCalculation;
        }
    }

    /**
     * @notice If time, calculates the EMA for all the Pegged Token prices.
     * @dev All price provider prices must be available, fails if not
     */
    function updateEmas() public {
        if (shouldCalculateEma()) {
            uint256 pegAmount = pegContainer.length;
            for (uint256 i = 0; i < pegAmount; i = unchecked_inc(i)) {
                updateTPema(i);
            }
            _updateNextEmaCalculation(emaCalculationBlockSpan);
        }
    }

    /**
     * @param blockSpan_ Defines how many blocks should pass between BMA calculations
     **/
    function setEmaCalculationBlockSpan(uint256 blockSpan_) external onlyAuthorizedChanger {
        emaCalculationBlockSpan = blockSpan_;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
