// SPDX-License-Identifier: MIT
// slither-disable-next-line solc-version
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract ERC20Mock is ERC20Burnable {
    uint256 internal constant UINT256_MAX = ~uint256(0);

    constructor() ERC20("ERC20Mock", "ERC20Mock") {
        _mint(msg.sender, UINT256_MAX / 10**10);
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }
}
