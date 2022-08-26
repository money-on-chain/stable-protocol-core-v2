pragma solidity ^0.8.16;

import "../../collateral/coinbase/MocCACoinbase.sol";

/**
 * @title MocCoinbaseMock
 * @dev Only for testing purpuses
 */
contract MocCoinbaseMock is MocCACoinbase {
    uint256 public newVariable;

    function initializeMock() public {
        newVariable = 42;
    }

    function getCustomMockValue() public view returns (uint256) {
        return newVariable + ctarg;
    }
}
