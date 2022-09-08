pragma solidity ^0.8.16;

import "./governance/MocUpgradable.sol";

contract MocSettlement is MocUpgradable {
    uint256 public bes; // Cantidad de bloques entre settlements
    uint256 public bns; // Bloque del siguiente settlement
    uint256 public bmulcdj; // Multiplicador de bloques de ajuste de cobertura. Cada cuanto se hace el ajuste
    uint256 public bncdj; // Bloque del siguiente ajuste de cobertura

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param governor_ The address that will define when a change contract is authorized
     * @param stopper_ The address that is authorized to pause this contract
     */
    function initialize(IGovernor governor_, address stopper_) external initializer {
        __MocUpgradable_init(governor_, stopper_);
    }

    function getBts() external view returns (uint256) {
        if (block.number >= bns) return 0;
        return bns - block.number;
    }
}
