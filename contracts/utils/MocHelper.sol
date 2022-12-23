// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

abstract contract MocHelper {
    error InvalidAddress();
    error InvalidValue();
    uint256 internal constant PRECISION = 10 ** 18;
    uint256 internal constant ONE = 10 ** 18;
    uint256 internal constant UINT256_MAX = ~uint256(0);

    // Saves gas
    // https://github.com/KadenZipfel/gas-optimizations/blob/main/gas-saving-patterns/unchecked-arithmetic.md
    function unchecked_inc(uint256 i) internal pure returns (uint256) {
        unchecked {
            return i + 1;
        }
    }

    /**
     * @notice add precision and div two number
     * @param a_ numerator
     * @param b_ denominator
     * @return `a_` * PRECISION / `b_`
     */
    function _divPrec(uint256 a_, uint256 b_) internal pure returns (uint256) {
        return (a_ * PRECISION) / b_;
    }

    /**
     * @notice multiply two number and remove precision
     * @param a_ term 1
     * @param b_ term 2
     * @return `a_` * `b_` / PRECISION
     */
    function _mulPrec(uint256 a_, uint256 b_) internal pure returns (uint256) {
        return (a_ * b_) / PRECISION;
    }

    /**
     * @notice reverts if value if less than PRECISION ONE
     * @param value_ value to check [PREC]
     */
    function _checkLessThanOne(uint256 value_) internal pure {
        if (value_ > ONE) revert InvalidValue();
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
