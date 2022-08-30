pragma solidity ^0.8.16;

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
    // ------- Initializer -------
    /**
     * @notice contract initializer
     */
    /* solhint-disable-next-line no-empty-blocks */
    function __MocEma_init_unchained() internal onlyInitializing {}

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
