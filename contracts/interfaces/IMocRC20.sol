// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IMocRC20
 * @notice Base Moc ERC20 Token Interface: burn, mint. It can be both Pegs and Collateral Tokens.
 */
interface IMocRC20 is IERC20 {
    /**
     * @dev Creates `amount` new tokens for `to`.
     * See {ERC20-_mint}.
     */
    function mint(address to, uint256 amount) external;

    /**
     * @dev Burns a specific `amount` of tokens for `to`.
     * * See {ERC20-_burn}.
     */
    function burn(address to, uint256 amount) external;
}
