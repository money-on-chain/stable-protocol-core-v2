pragma solidity ^0.8.17;

import "./MocEma.sol";

/**
 * @title MocSettlement
 * @notice Moc Settlement, groups all functions, state and tracking relative to the settlement execution.
 */
abstract contract MocSettlement is MocEma {
    // ------- Events -------
    event SettlementExecuted();

    // ------- Storage -------
    // number of blocks between settlements
    uint256 public bes;
    // next settlement block
    uint256 public bns;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param bes_ number of blocks between settlements
     */
    function __MocSettlement_init_unchained(uint256 bes_) internal onlyInitializing {
        bes = bes_;
        bns = block.number + bes_;
    }

    // ------- Internal abstract Functions -------

    function _execSettlement() internal virtual;

    // ------- External Functions -------

    function execSettlement() external notPaused {
        // check if it is in the corresponding block to execute the settlement
        if (block.number >= bns) {
            bns = block.number + bes;
            emit SettlementExecuted();
            _execSettlement();
        }
    }

    /**
     * @notice get the number of blocks remaining for settlement
     */
    function getBts() external view returns (uint256) {
        if (block.number >= bns) return 0;
        return bns - block.number;
    }

    /**
     * @param bes_ number of blocks between settlements
     **/
    function setBes(uint256 bes_) external onlyAuthorizedChanger {
        bes = bes_;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
