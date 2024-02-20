// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { MocRC20, IGovernor, IMocRC20 } from "./MocRC20.sol";
/* solhint-disable-next-line max-line-length */
import { ERC20PausableUpgradeable, ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";

/**
 * @title MocTC
 * @notice Base Moc  ERC20 Collateral Tokens: Allows burn, mint and pause.
 * @dev ERC20 like token that allows roles allowed contracts to mint and burn (destroyed) any token.
 */
contract MocTC is MocRC20, ERC20PausableUpgradeable {
    bytes32 private constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Grants `PAUSER_ROLE` to `admin` address.
     *
     * See {MocRC20-constructor}.
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        address admin_,
        IGovernor governor_
    ) external override initializer {
        __MocRC20_init(name_, symbol_, admin_, governor_);
        __ERC20Pausable_init();
        _grantRole(PAUSER_ROLE, admin_);
    }

    /**
     * @dev override only to satisfy compiler
     * @inheritdoc ERC20PausableUpgradeable
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        ERC20PausableUpgradeable._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @dev Pauses the contract.
     * See {ERC20PausableUpgradeable-_pause}.
     *
     * Requirements:
     *
     * - the caller must have the `PAUSER_ROLE`.
     */
    function pause() external virtual onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Grants all `roles` to `account` while sender renounces to all ``role``.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     * - no one else must have any other role
     *
     * May emit a {RoleGranted x4, RoleRevoked x4} event.
     */
    function transferAllRoles(address account) public override onlyRole(getRoleAdmin(DEFAULT_ADMIN_ROLE)) {
        if (getRoleMemberCount(PAUSER_ROLE) != 1) revert NotUniqueRole(PAUSER_ROLE);
        _grantRole(PAUSER_ROLE, account);
        _revokeRole(PAUSER_ROLE, msg.sender);
        super.transferAllRoles(account);
    }
}
