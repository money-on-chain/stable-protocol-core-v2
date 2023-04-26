// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

// This contract is not intended to be used in a production system
// It was designed to be used in a testing environment only

import { MocTC, ERC20Upgradeable } from "../../tokens/MocTC.sol";
import { IERC20Upgradeable } from "../../interfaces/IMocRC20.sol";

/**
 * @title MocTcMock
 * @dev Only for upgradeability testing purposes.
 */
contract MocTcMock is MocTC {
    uint256 public newVariable;

    function initializeMock() external {
        newVariable = 42;
    }

    function totalSupply() public view override(ERC20Upgradeable, IERC20Upgradeable) returns (uint256) {
        return 1 + newVariable + super.totalSupply();
    }
}
