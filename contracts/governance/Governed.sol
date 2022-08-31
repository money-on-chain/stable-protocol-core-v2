pragma solidity 0.8.16;

import "../interfaces/IGovernor.sol";
import "../utils/MocHelper.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
  @title Governed
  @notice Base contract to be inherited by governed contracts
  @dev This contract is not usable on its own since it does not have any _productive useful_ behaviour
  The only purpose of this contract is to define some useful modifiers and functions to be used on the
  governance aspect of the child contract
  */
abstract contract Governed is Initializable, MocHelper {
    /**
    @notice The address of the contract which governs this one
   */
    IGovernor public governor;

    error NotAuthorizedChanger();

    /**
    @notice Modifier that protects the function
    @dev You should use this modifier in any function that should be called through
    the governance system
   */
    modifier onlyAuthorizedChanger() {
        checkIfAuthorizedChanger();
        _;
    }

    /**
    @notice Initialize the contract with the basic settings
    @dev This initialize replaces the constructor but it is not called automatically.
    It is necessary because of the upgradeability of the contracts
    @param governor_ Governor address
   */
    function __Governed_init(IGovernor governor_) internal onlyInitializing {
        __Governed_init_unchained(governor_);
    }

    function __Governed_init_unchained(IGovernor governor_) internal onlyInitializing {
        if (address(governor_) == address(0)) revert InvalidAddress();
        governor = IGovernor(governor_);
    }

    /**
    @notice Change the contract's governor. Should be called through the old governance system
    @param newGovernor_ New governor address
   */
    function changeIGovernor(IGovernor newGovernor_) public onlyAuthorizedChanger {
        if (address(newGovernor_) == address(0)) revert InvalidAddress();
        governor = newGovernor_;
    }

    /**
    @notice Checks if the msg sender is an authorized changer, reverts otherwise
   */
    function checkIfAuthorizedChanger() internal view {
        if (!governor.isAuthorizedChanger(msg.sender)) revert NotAuthorizedChanger();
    }

    // Leave a gap betweeen inherited contracts variables in order to be
    // able to add more variables in them later
    uint256[50] private upgradeGap;
}
