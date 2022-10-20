pragma solidity ^0.8.17;

import "../interfaces/IMocRC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MocRC20
 * @notice Base Moc ERC20 Token: burn, mint. It can be both Pegs and Collateral Tokens.
 * @dev ERC20 like token that allows roles allowed contracts to mint and burn (destroyed) any token.
 */
contract MocRC20 is AccessControlEnumerable, ERC20, IMocRC20 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /**
     * @dev Grants `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE` & `BURNER_ROLE` to `admin` address.
     *
     * See {ERC20-constructor}.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address admin_
    ) ERC20(name_, symbol_) {
        _setupRole(DEFAULT_ADMIN_ROLE, admin_);
        _setupRole(MINTER_ROLE, admin_);
        _setupRole(BURNER_ROLE, admin_);
    }

    /**
     * @dev Creates `amount` new tokens for `to`.
     * See {ERC20-_mint}.
     *
     * Requirements:
     *
     * - the caller must have the `MINTER_ROLE`.
     */
    function mint(address to, uint256 amount) public virtual onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @dev Burns a specific `amount` of tokens for `to`.
     * * See {ERC20-_burn}.
     * Requirements:
     *
     * - the caller must have the `BURNER_ROLE`.
     */
    function burn(address to, uint256 amount) public virtual onlyRole(BURNER_ROLE) {
        _burn(to, amount);
    }

    /**
     * @inheritdoc IMocRC20
     */
    function hasFullRoles(address _account) public view virtual override returns (bool) {
        return
            hasRole(MINTER_ROLE, _account) && hasRole(BURNER_ROLE, _account) && hasRole(DEFAULT_ADMIN_ROLE, _account);
    }
}
