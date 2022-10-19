pragma solidity 0.8.17;

import "../../interfaces/IGovernor.sol";
import "../../interfaces/IChangeContract.sol";

/**
  @title GovernorMock
  @dev Test only contract to mock Governor behavior 
*/
contract GovernorMock is IGovernor {
    /**
    @notice Function to be called to make the changes in changeContract
    @param changeContract Address of the contract that will execute the changes
   */
    function executeChange(IChangeContract changeContract) external {
        changeContract.execute();
    }

    function isAuthorizedChanger(address) external pure returns (bool) {
        return true;
    }
}
