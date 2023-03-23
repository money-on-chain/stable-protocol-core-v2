// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import { IMocRC20 } from "../interfaces/IMocRC20.sol";
import { IGovernor, Governed } from "../governance/Governed.sol";
/* solhint-disable-next-line max-line-length */
import { AccessControlEnumerableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title MocRC20
 * @notice Base Moc ERC20 Token: burn, mint. It can be both Pegs and Collateral Tokens.
 * @dev ERC20 like token that allows roles allowed contracts to mint and burn (destroyed) any token.
 */
contract MocRC20 is IMocRC20, AccessControlEnumerableUpgradeable, ERC20Upgradeable, UUPSUpgradeable, Governed {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * See {__MocRC20_init}.
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        address admin_,
        IGovernor governor_
    ) external virtual initializer {
        __MocRC20_init(name_, symbol_, admin_, governor_);
        _setupRole(MINTER_ROLE, admin_);
        _setupRole(BURNER_ROLE, admin_);
    }

    /**
     * @dev Grants `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE` & `BURNER_ROLE` to `admin` address.
     *
     * See {ERC20_init}.
     */
    function __MocRC20_init(
        string memory name_,
        string memory symbol_,
        address admin_,
        IGovernor governor_
    ) internal onlyInitializing {
        __ERC20_init(name_, symbol_);
        __AccessControlEnumerable_init();
        __UUPSUpgradeable_init();
        __Governed_init(address(governor_));
        _setupRole(DEFAULT_ADMIN_ROLE, admin_);
    }

    /* solhint-disable-next-line no-empty-blocks */
    function _authorizeUpgrade(address newImplementation) internal override onlyAuthorizedChanger {}

    /**
     * @dev Creates `amount` new tokens for `to`.
     * See {ERC20-_mint}.
     *
     * Requirements:
     *
     * - the caller must have the `MINTER_ROLE`.
     */
    function mint(address to, uint256 amount) external virtual onlyRole(MINTER_ROLE) returns (bool) {
        _mint(to, amount);
        return true;
    }

    /**
     * @dev Burns a specific `amount` of tokens for `to`.
     * * See {ERC20-_burn}.
     * Requirements:
     *
     * - the caller must have the `BURNER_ROLE`.
     */
    function burn(address to, uint256 amount) external virtual onlyRole(BURNER_ROLE) {
        _burn(to, amount);
    }

    /**
     * @dev Grants all `roles` to `account` and sender renounces to ``role``'s admin role.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleGranted x3, RoleRevoked x1} event.
     */
    function grantAllRoles(address account) public virtual onlyRole(getRoleAdmin(DEFAULT_ADMIN_ROLE)) {
        _grantRole(DEFAULT_ADMIN_ROLE, account);
        _grantRole(MINTER_ROLE, account);
        _grantRole(BURNER_ROLE, account);
        _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
}
