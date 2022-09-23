pragma solidity ^0.8.16;

import "./MocRC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

/**
 * @title MocTC
 * @notice Base Moc  ERC20 Collateral Tokens: Allows burn, mint and pause.
 * @dev ERC20 like token that allows roles allowed contracts to mint and burn (destroyed) any token.
 */
contract MocTC is MocRC20, ERC20Pausable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /**
     * @dev Grants `PAUSER_ROLE` to `admin` address.
     *
     * See {MocRC20-constructor}.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address admin_
    ) MocRC20(name_, symbol_, admin_) {
        _setupRole(PAUSER_ROLE, admin_);
    }

    /**
     * @dev override only to satisfy compiler
     * @inheritdoc ERC20Pausable
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20, ERC20Pausable) {
        ERC20Pausable._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @dev Pauses the contract.
     * See {ERC20Pausable-_pause}.
     *
     * Requirements:
     *
     * - the caller must have the `PAUSER_ROLE`.
     */
    function pause() public virtual onlyRole(PAUSER_ROLE) {
        _pause();
    }
}
