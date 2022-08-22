pragma solidity ^0.8.16;

import "../tokens/MocRC20.sol";
import "../interfaces/IMocRC20.sol";
import "./MocBaseBucket.sol";
import "./MocEma.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MocCore
 * @notice MocCore nucleats all the basic MoC functionality and toolset. It allows Collateral
 * asset aware contracts to implement the main mint/redeem operations.
 */
// solhint-disable-next-line no-empty-blocks
abstract contract MocCore is MocBaseBucket, MocEma, Pausable {

}
