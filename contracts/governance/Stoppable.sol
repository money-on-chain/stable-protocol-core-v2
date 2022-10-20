pragma solidity 0.8.17;

import "./Governed.sol";

/**
  @title Stoppable
  @notice Allow a contract to be paused through the stopper subsystem. This contracts
  is able to disable the stoppability feature through governance.
  @dev This contract was heavily based on the _Pausable_ contract of openzeppelin-eth but
  it was modified in order to being able to turn on and off its stoppability
 */
contract Stoppable is Governed {
    event Paused(address account);
    event Unpaused(address account);

    bool public stoppable;
    bool private _paused;
    address public pauser;

    // ------- Custom Errors -------
    error Unstoppable();
    error OnlyWhilePaused();
    error NotAllowWhenPaused();
    error OnlyPauser();

    /**
    @notice Modifier to make a function callable only when the contract is not paused
  */
    modifier whenNotPaused() {
        if (_paused) revert NotAllowWhenPaused();
        _;
    }

    /**
    @notice Modifier to make a function callable only when the contract is paused
    */
    modifier whenPaused() {
        if (!_paused) revert OnlyWhilePaused();
        _;
    }

    /**
    @notice Initialize the contract with the basic settings
    @dev This initialize replaces the constructor but it is not called automatically.
    It is necessary because of the upgradeability of the contracts. Either this function or the previous can be used
    @param pauserAddress_ The address that is authorized to pause this contract
    @param stoppable_ Define if the contract starts being unstoppable or not
   */
    function __Stoppable_init_unchained(address pauserAddress_, bool stoppable_) internal onlyInitializing {
        if (pauserAddress_ == address(0)) revert InvalidAddress();
        stoppable = stoppable_;
        pauser = pauserAddress_;
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
    function pause() public whenNotPaused {
        if (msg.sender != pauser) revert OnlyPauser();
        if (!stoppable) revert Unstoppable();
        _paused = true;
        emit Paused(msg.sender);
    }

    /**
    @notice Called by the owner to unpause, returns to normal state
   */
    function unpause() public whenPaused {
        if (msg.sender != pauser) revert OnlyPauser();
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
    @notice Changes the address which is enable to pause this contract
    @param newPauser_ Address of the new pauser
    @dev Should be called through governance
   */
    function setPauser(address newPauser_) public onlyAuthorizedChanger {
        if (newPauser_ == address(0)) revert InvalidAddress();
        pauser = newPauser_;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
