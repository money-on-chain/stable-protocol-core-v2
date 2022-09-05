pragma solidity ^0.8.16;

import "../governance/Stoppable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
// Import to allow compilation and deploy of ERC1967Proxy
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

abstract contract MocUpgradable is UUPSUpgradeable, Stoppable {
    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param stopper_ The address that is authorized to stop this contract
     * @param governor_ The address that will define when a change contract is authorized
     */
    function __MocUpgradable_init(IGovernor governor_, address stopper_) internal onlyInitializing {
        __UUPSUpgradeable_init();
        __Governed_init(governor_);
        __Stoppable_init_unchained(stopper_, true);
    }

    /* solhint-disable-next-line no-empty-blocks */
    function _authorizeUpgrade(address newImplementation) internal override onlyAuthorizedChanger {}
}