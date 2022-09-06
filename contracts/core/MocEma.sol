pragma solidity ^0.8.16;

import "../interfaces/IMocRC20.sol";
import "./MocBaseBucket.sol";

/**
 * @title MocEma: Exponential Moving Average
 * @notice Moc Ema, provides a set of methods that allows to calculate and track
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
    // TP EMA items, indexes are in sync with PeggedTokens across Moc solution
    EmaItem[] public tpEma;
    // last Ema Calculation Block number
    uint256 public lastEmaCalculation;
    // amount of blocks to wait for next ema calculation
    uint256 public emaCalculationBlockSpan;

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param emaCalculationBlockSpan_ amount of blocks to wait between Peeged ema calculation
     */
    /* solhint-disable-next-line no-empty-blocks */
    function __MocEma_init_unchained(uint256 emaCalculationBlockSpan_) internal onlyInitializing {
        if (emaCalculationBlockSpan_ == 0) revert InvalidValue();
        lastEmaCalculation = block.number;
        emaCalculationBlockSpan = emaCalculationBlockSpan_;
    }

    // ------- Public Functions -------

    /**
     * @notice calculates target coverage adjusted by all Pegged Token's to Collateral Asset rate moving average
     * @return ctargema [PREC]
     */
    function calcCtargema() public returns (uint256 ctargema) {
        // Make sure EMAs are up to date for all the pegs
        updateEmas();
        uint256 num;
        uint256 den;
        uint256 pegAmount = pegContainer.length;
        for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
            uint256 nTP = pegContainer[i].nTP;
            // [PREC] = [N] * [PREC]
            num += nTP * tpEma[i].ema;
            // [PREC] = [N] * [PREC]
            den += nTP * _getPTPac(i);
        }
        if (den >= num || den == 0) return ctarg;
        // [PREC] = [PREC] * [PREC] / [PREC]
        ctargema = (ctarg * num) / den;
    }

    /**
     * @notice true if the necessiry span has pass since last ema update
     */
    function shouldCalculateEma() public view returns (bool) {
        unchecked {
            return block.number >= lastEmaCalculation + emaCalculationBlockSpan;
        }
    }

    /**
     * @notice If time, calculates the EMA for all the Pegged Token prices.
     * @dev All price provider prices must be available, fails if not
     */
    function updateEmas() public {
        if (shouldCalculateEma()) {
            uint256 pegAmount = pegContainer.length;
            for (uint8 i = 0; i < pegAmount; i = unchecked_inc(i)) {
                updateTPema(i);
            }
            lastEmaCalculation = block.number;
        }
    }

    /**
     * @notice update exponential moving average of the value of a Pegged Token
     * @dev more information of EMA calculation https://en.wikipedia.org/wiki/Exponential_smoothing
     * @param i_ Pegged Token index
     */
    function updateTPema(uint8 i_) internal {
        EmaItem memory currentTPema = tpEma[i_];
        uint256 pTPac = _getPTPac(i_);
        // [PREC] = [PREC] * [PREC] / ([PREC] - [PREC])
        uint256 term1 = (PRECISION * currentTPema.ema) / (ONE - currentTPema.sf);
        // [PREC] = [PREC] * [PREC] / [PREC]
        uint256 term2 = (PRECISION * currentTPema.sf) / pTPac;
        // [PREC] = [PREC] + [PREC]
        uint256 newEma = term1 + term2;
        // save new ema value to storage
        tpEma[i_].ema = newEma;
        emit TPemaUpdated(i_, currentTPema.ema, newEma);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
