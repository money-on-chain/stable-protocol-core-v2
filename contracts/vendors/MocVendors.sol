// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import { MocUpgradable } from "../governance/MocUpgradable.sol";

/**
 * @title MocVendors
 * @notice MocVendors allows a third-party to add a markup to all operations
 *  A vendor can set a markup themselves or ask vendors guardian to do it on their behalf.
 *  Considerations:
 *  - Theres is not a markup limit or restriction
 *  - The currency that the vendor receives is always the same that is used to pay fees(AC or Fee Token)
 *  - A malicious vendor front running an operation increasing the markup is protected in some way
 *      by the maximum (AC or Fee Token) that the user expect to spend(or de minimum that expect to receive)
 */
contract MocVendors is MocUpgradable {
    // ------- Events -------
    event VendorMarkupChanged(address indexed vendorAddress_, uint256 newMarkup_);
    // ------- Custom Errors -------
    error NotVendorsGuardian(address sender_);

    // ------- Storage -------

    // address authorized to change a vendor's markup
    address public vendorsGuardianAddress;
    // addition markup pct applied on each operation when operating through a vendor [PREC]
    mapping(address => uint256) public vendorMarkup; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18

    // ------- Initializer -------

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice contract initializer
     * @param vendorsGuardianAddress_ The address authorized to change a vendor's markup
     * @param governorAddress_ The address that will define when a change contract is authorized
     * @param pauserAddress_ The address that is authorized to pause this contract
     */
    function initialize(
        address vendorsGuardianAddress_,
        address governorAddress_,
        address pauserAddress_
    ) external initializer {
        vendorsGuardianAddress = vendorsGuardianAddress_;
        __MocUpgradable_init(governorAddress_, pauserAddress_);
    }

    // ------- Internal Functions -------

    /**
     * @notice sets a vendor markup
     * @param vendorAddress_ vendor address to change markup
     * @param newMarkup_ new markup applied to vendor [PREC]
     */
    function _setMarkup(address vendorAddress_, uint256 newMarkup_) internal {
        vendorMarkup[vendorAddress_] = newMarkup_;
        emit VendorMarkupChanged(vendorAddress_, newMarkup_);
    }

    // ------- External Functions -------

    /**
     * @notice vendor sets its own markup
     * @param newMarkup_ new markup applied to vendor [PREC]
     */
    function setMarkup(uint256 newMarkup_) external {
        _setMarkup(msg.sender, newMarkup_);
    }

    /**
     * @notice guardian sets a vendor markup
     * @param vendorAddress_ vendor address to change markup
     * @param newMarkup_ new markup applied to vendor [PREC]
     */
    function setVendorMarkup(address vendorAddress_, uint256 newMarkup_) external {
        if (msg.sender != vendorsGuardianAddress) revert NotVendorsGuardian(msg.sender);
        _setMarkup(vendorAddress_, newMarkup_);
    }

    // ------- Only Authorized Changer Functions -------

    /**
     * @dev Sets the address which will be authorized to set a vendor markup.
     * @param vendorsGuardianAddress_ Address which will be authorized to set a vendor markup.
     */
    function setVendorsGuardianAddress(address vendorsGuardianAddress_) public onlyAuthorizedChanger {
        // slither-disable-next-line missing-zero-check
        vendorsGuardianAddress = vendorsGuardianAddress_;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
