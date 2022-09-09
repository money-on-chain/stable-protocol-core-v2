pragma solidity ^0.8.16;

import "./governance/MocUpgradable.sol";

contract MocSettlement is MocUpgradable {
    // ------- Storage -------
    // number of blocks between settlements
    uint256 public bes;
    // next settlement block
    uint256 public bns;
    // coverage adjustment block multiplier. How often the adjustment is made
    uint256 public bmulcdj;
    // next coverage adjustment block
    uint256 public bncdj;

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param governor_ The address that will define when a change contract is authorized
     * @param stopper_ The address that is authorized to pause this contract
     */
    function initialize(IGovernor governor_, address stopper_) external initializer {
        __MocUpgradable_init(governor_, stopper_);
    }

    /**
     * @notice get the number of blocks remaining for settlement
     */
    function getBts() external view returns (uint256) {
        if (block.number >= bns) return 0;
        return bns - block.number;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
