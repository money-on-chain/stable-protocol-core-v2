pragma solidity 0.8.16;

import "./Governed.sol";

/**
  @title Stoppable
  @notice Allow a contract to be paused through the stopper subsystem. This contracts
  is able to disable the stoppability feature through governance.
  @dev This contract was heavily based on the _Pausable_ contract of openzeppelin-eth but
  it was modified in order to being able to turn on and off its stopability
 */
// TODO: review
contract Stoppable is Governed {
    event Paused(address account);
    event Unpaused(address account);

    bool public stoppable;
    bool private _paused;
    address public stopper;
    string private constant UNSTOPPABLE = "unstoppable";
    string private constant CONTRACT_IS_ACTIVE = "contract_is_active";
    string private constant CONTRACT_IS_PAUSED = "contract_is_paused";
    string private constant NOT_STOPPER = "not_stopper";

    /**
    @notice Modifier to make a function callable only when the contract is enable
    to be paused
  */
    modifier whenStoppable() {
        require(stoppable, UNSTOPPABLE);
        _;
    }

    /**
    @notice Modifier to make a function callable only when the contract is not paused
  */
    modifier whenNotPaused() {
        require(!_paused, CONTRACT_IS_PAUSED);
        _;
    }

    /**
    @notice Modifier to make a function callable only when the contract is paused
    */
    modifier whenPaused() {
        require(_paused, CONTRACT_IS_ACTIVE);
        _;
    }

    /**
    @notice  Modifier to make a function callable only by the pauser
   */
    modifier onlyPauser() {
        require(stopper == msg.sender, NOT_STOPPER);
        _;
    }

    /**
    @notice Initialize the contract with the basic settings
    @dev This initialize replaces the constructor but it is not called automatically.
    It is necessary because of the upgradeability of the contracts. Either this function or the previous can be used
    @param stopper_ The address that is authorized to stop this contract
    @param stoppable_ Define if the contract starts being unstoppable or not
   */
    function __Stoppable_init_unchained(address stopper_, bool stoppable_) internal onlyInitializing {
        if (stopper_ == address(0)) revert InvalidAddress();
        stoppable = stoppable_;
        stopper = stopper_;
    }

    /**
    @notice Returns true if paused
   */
    function paused() public view returns (bool) {
        return _paused;
    }

    /**
    @notice Called by the owner to pause, triggers stopped state
    @dev Should only be called by the pauser and when it is stoppable
   */
    function pause() public whenStoppable onlyPauser whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }

    /**
    @notice Called by the owner to unpause, returns to normal state
   */
    function unpause() public onlyPauser whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }

    /**
    @notice Switches OFF the stoppability of the contract; if the contract was paused
    it will no longer be so
    @dev Should be called through governance
   */
    function makeUnstoppable() public onlyAuthorizedChanger {
        stoppable = false;
    }

    /**
    @notice Switches ON the stoppability of the contract; if the contract was paused
    before making it unstoppable it will be paused again after calling this function
    @dev Should be called through governance
   */
    function makeStoppable() public onlyAuthorizedChanger {
        stoppable = true;
    }

    /**
    @notice Changes the address which is enable to stop this contract
    @param newStopper Address of the newStopper
    @dev Should be called through governance
   */
    function setStopper(address newStopper) public onlyAuthorizedChanger {
        if (newStopper == address(0)) revert InvalidAddress();
        stopper = newStopper;
    }

    // Leave a gap betweeen inherited contracts variables in order to be
    // able to add more variables in them later
    uint256[50] private upgradeGap;
}
