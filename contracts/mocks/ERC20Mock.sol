// SPDX-License-Identifier: MIT
// slither-disable-next-line solc-version
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract ERC20Mock is ERC20Burnable {
    uint256 internal constant UINT256_MAX = ~uint256(0);
    bool internal failWithFalse;
    bool internal failWithRevert;

    constructor() ERC20("ERC20Mock", "ERC20Mock") {
        _mint(msg.sender, UINT256_MAX / 10**10);
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (failWithFalse) {
            return false;
        }
        if (failWithRevert) {
            // solhint-disable-next-line reason-string
            require(false);
        }
        return super.transfer(to, amount);
    }

    function forceTransferToFail(uint256 failType) external {
        // failType: 0 disable, 1 false, 2 revert
        if (failType == 0) {
            failWithFalse = false;
            failWithRevert = false;
        }
        if (failType == 1) {
            failWithFalse = true;
            failWithRevert = false;
        }
        if (failType == 2) {
            failWithFalse = false;
            failWithRevert = true;
        }
    }
}
