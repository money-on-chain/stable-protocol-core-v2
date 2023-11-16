// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { MocUpgradable } from "../governance/MocUpgradable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title MocAccessControlled
 * @notice Extends Moc Upgradable capabilities, with access control capabilities
 * @dev grant and revoke functions are overwritten so that they are also
 *      compatible with governance authorization mechanism.
 */
abstract contract MocAccessControlled is MocUpgradable, AccessControlUpgradeable {
    // ------- Public Functions -------

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role  OR
     *   the caller must have be an authorized Governance changer.
     *
     * May emit a {RoleGranted} event.
     */
    function grantRole(bytes32 role, address account) public virtual override {
        verifyRoleManagementPrivilege(role);
        _grantRole(role, account);
    }

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role  OR
     *   the caller must have be an authorized Governance changer.
     *
     * May emit a {RoleRevoked} event.
     */
    function revokeRole(bytes32 role, address account) public virtual override {
        verifyRoleManagementPrivilege(role);
        _revokeRole(role, account);
    }

    // ------- Internal Functions -------

    function verifyRoleManagementPrivilege(bytes32 role) private view {
        if (!governor.isAuthorizedChanger(msg.sender) && !hasRole(getRoleAdmin(role), msg.sender))
            revert NotAuthorizedChanger();
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
