pragma solidity ^0.8.17;

import "../governance/Stoppable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
// Import to allow compilation and deploy of ERC1967Proxy
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

abstract contract MocUpgradable is UUPSUpgradeable, Stoppable {
    // ------- Initializer -------
    /**
     * @notice contract initializer
     * @param governorAddress_ The address that will define when a change contract is authorized
     * @param pauserAddress_ The address that is authorized to pause this contract
     */
    function __MocUpgradable_init(address governorAddress_, address pauserAddress_) internal onlyInitializing {
        __UUPSUpgradeable_init();
        __Governed_init(governorAddress_);
        __Stoppable_init_unchained(pauserAddress_, true);
    }

    /* solhint-disable-next-line no-empty-blocks */
    function _authorizeUpgrade(address newImplementation) internal override onlyAuthorizedChanger {}

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
