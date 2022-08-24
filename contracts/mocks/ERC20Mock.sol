// SPDX-License-Identifier: MIT
// slither-disable-next-line solc-version
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract ERC20Mock is ERC20Burnable {
    constructor() ERC20("ERC20Mock", "ERC20Mock") {
        _mint(msg.sender, 100_000 ether);
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }
}
