pragma solidity 0.8.16;

import "../../interfaces/IChangeContract.sol";
import "../../governance/Governed.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
  @title GovernanceChangerTemplate
  @notice This contract is a ChangeContract intended to be used with Moc Aeropulus 
  governance system.
 */
contract GovernanceChangerTemplate is IChangeContract {
    Governed public governed;
    IGovernor public newGovernor;

    /** 
    @notice Constructor
    @param governed_ Address of the contract whos Governor we want to change
    @param newGovernor_ Address of the new Governor
  */
    constructor(Governed governed_, IGovernor newGovernor_) {
        governed = governed_;
        newGovernor = newGovernor_;
    }

    /**
    @notice Execute the changes.
    @dev Should be called by the governor, but this contract does not check that explicitly
    because it is not its responsability in the current architecture
    IMPORTANT: This function should not be overriden, you should only redefine
    _beforeUpgrade and _afterUpgrade methods to use this template
   */
    function execute() external {
        governed.changeGovernor(newGovernor);
    }
}
