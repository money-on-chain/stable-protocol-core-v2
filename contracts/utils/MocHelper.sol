pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract MocHelper {
    error InvalidAddress();
    error InvalidValue();
    uint256 internal constant PRECISION = 10**18;
    uint256 internal constant ONE = 10**18;
    uint256 internal constant UINT256_MAX = ~uint256(0);

    // Saves gas
    // https://github.com/KadenZipfel/gas-optimizations/blob/main/gas-saving-patterns/unchecked-arithmetic.md
    function unchecked_inc(uint8 i) internal pure returns (uint8) {
        unchecked {
            return i + 1;
        }
    }
}