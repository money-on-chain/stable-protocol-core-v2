// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { IGovernor } from "../../interfaces/IGovernor.sol";
import { IChangeContract } from "../../interfaces/IChangeContract.sol";

/**
  @title GovernorMock
  @dev Test only contract to mock Governor behavior 
*/
contract GovernorMock is IGovernor {
    bool public isAuthorized = true;

    /**
    @notice Function to be called to make the changes in changeContract
    @param changeContract Address of the contract that will execute the changes
   */
    function executeChange(IChangeContract changeContract) external {
        changeContract.execute();
    }

    function isAuthorizedChanger(address) external view override returns (bool) {
        return isAuthorized;
    }

    function setIsAuthorized(bool isAuthorized_) public {
        isAuthorized = isAuthorized_;
    }
}
