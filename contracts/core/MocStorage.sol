// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import "./MocEma.sol";

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
//    +-----------------+
//    |    MocStorage   |
//    +-----------------+
//            ^
//            | is
//            | _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
//            |                              |
//    +-----------------+ contains  +-----------------+
//    |     MocCore     | ------>   |MocCoreExpansion |
//    +-----------------+           +-----------------+
//            ^
//            | is
//            | _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
//            |                              |
//    +-----------------+           +-----------------+
//    |  MocCACoinbase  |           |    MocCARC20    |
//    +-----------------+           +-----------------+
/**
 * @title MocStorage
 * @notice To expand the 24kb size limitation we use MocCoreExpansion contract. Some functions are implemented
 *  there and MocCore delegates calls to it. To achieve that, we need mocCore and MocCoreExpansion have the same storage
 *  layout. So, The MocStorage contract serves as the link between them, and all storage variables must be declared here
 *  or in a parent contract. Declaring variables after this point could result in storage collisions.
 */
abstract contract MocStorage is MocEma {
    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
