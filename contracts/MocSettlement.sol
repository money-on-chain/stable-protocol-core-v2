pragma solidity ^0.8.17;

import "./governance/MocUpgradable.sol";
import "./core/MocCore.sol";

contract MocSettlement is MocUpgradable {
    // ------- Storage -------
    // MocCore contract
    MocCore internal mocCore;
    // number of blocks between settlements
    uint256 public bes;
    // next settlement block
    uint256 public bns;
    // coverage adjustment block multiplier. How often the adjustment is made
    uint256 internal bmulcdj;
    // next coverage adjustment block
    uint256 internal bncdj;

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param governorAddress_ The address that will define when a change contract is authorized
     * @param pauserAddress_ The address that is authorized to pause this contract
     * @param mocCoreAddress_ MocCore contract address
     * @param bes_ number of blocks between settlements
     * @param bmulcdj_ coverage adjustment block multiplier. How often the adjustment is made
     */
    function initialize(
        address governorAddress_,
        address pauserAddress_,
        address mocCoreAddress_,
        uint256 bes_,
        uint256 bmulcdj_
    ) external initializer {
        if (mocCoreAddress_ == address(0)) revert InvalidAddress();
        bes = bes_;
        bmulcdj = bmulcdj_;
        bns = block.number + bes_;
        bncdj = block.number + (bes_ * bmulcdj_);
        __MocUpgradable_init(governorAddress_, pauserAddress_);
    }

    // ------- External Functions -------

    // solhint-disable-next-line no-empty-blocks
    function execInt() external {
        //TODO: call interestRate interest adjustment
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