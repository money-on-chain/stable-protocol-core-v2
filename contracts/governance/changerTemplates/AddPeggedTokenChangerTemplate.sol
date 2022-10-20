pragma solidity 0.8.17;

import "../../interfaces/IChangeContract.sol";
import "../../core/MocCore.sol";

/**
  @title AddPeggedTokenChangerTemplate
  @notice This contract is a ChangeContract intended to be used with Moc Aeropulus 
  governance system. It allows the addition of a new Pegged Token to the system.
 */
contract AddPeggedTokenChangerTemplate is IChangeContract {
    // ------- Storage -------

    MocCore public mocCore;
    MocCore.AddPeggedTokenParams internal addPeggedTokenParams;

    /** 
    @notice Constructor
    @param mocCore_ Address of the contract to add Pegged Token to
  */
    constructor(MocCore mocCore_, MocCore.AddPeggedTokenParams memory addPeggedTokenParams_) {
        mocCore = mocCore_;
        addPeggedTokenParams = addPeggedTokenParams_;
    }

    /**
    @notice Execute the changes.
    @dev Should be called by the governor, but this contract does not check that explicitly
    because it is not its responsibility in the current architecture
    IMPORTANT: This function should not be overridden, you should only redefine
    _beforeUpgrade and _afterUpgrade methods to use this template
   */
    function execute() external {
        mocCore.addPeggedToken(addPeggedTokenParams);
    }
}
