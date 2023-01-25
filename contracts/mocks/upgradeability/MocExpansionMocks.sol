// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

// This contract is not intended to be used in a production system
// It was designed to be used in a testing environment only

import "../../governance/changerTemplates/UpgraderUUPSChangerTemplate.sol";
import "../../collateral/coinbase/MocCACoinbase.sol";
import "../../collateral/rc20/MocCARC20.sol";

/**
 * @title UpgradableMock
 * @dev Only for upgradeability testing purposes. Generic contract for initialize a mock and get a custom method.
 *  It is used to test that we can add storage variables to MocStorage and
 *  MocCore keeps the compatibility with MocCoreExpansion.
 */

abstract contract UpgradableMock is MocStorage {
    uint256 public newVariable;

    function initializeMock() external {
        newVariable = 52;
    }

    function getCustomMockValue() external view returns (uint256) {
        return newVariable + (protThrld / PRECISION);
    }

    function getExpansionCustomMockValue() external virtual returns (uint256);
}

contract MocCoreExpansionMock is UpgradableMock, MocCoreExpansion {
    function getExpansionCustomMockValue() external view override returns (uint256) {
        return newVariable;
    }
}

/**
 * @title MocCoinbaseWithExpansionMock
 * @dev Only for upgradeability testing purposes. Extends MocCACoinbase adding a new variable.
 */
contract MocCoinbaseWithExpansionMock is UpgradableMock, MocCACoinbase {
    function getExpansionCustomMockValue() external override returns (uint256) {
        bytes memory payload = abi.encodeCall(MocCoreExpansionMock(mocCoreExpansion).getExpansionCustomMockValue, ());
        uint256 newVariable_ = abi.decode(Address.functionDelegateCall(mocCoreExpansion, payload), (uint256));
        return newVariable_ + (protThrld / PRECISION);
    }
}

/**
 * @title MocCARC20WithExpansionMock
 * @dev Only for upgradeability testing purposes. Extends MocCARC20Mock adding a new variable.
 */
contract MocCARC20WithExpansionMock is UpgradableMock, MocCARC20 {
    function getExpansionCustomMockValue() external override returns (uint256) {
        bytes memory payload = abi.encodeCall(MocCoreExpansionMock(mocCoreExpansion).getExpansionCustomMockValue, ());
        uint256 newVariable_ = abi.decode(Address.functionDelegateCall(mocCoreExpansion, payload), (uint256));
        return newVariable_ + (protThrld / PRECISION);
    }
}

/**
 * @title MocUpgradeChangerWithExpansionMock
 * @dev Only for upgradeability testing purposes. Extends UpgraderUUPSTemplate so that it
 * can upgrade, via UUPS, the original Moc CA implementation and set a new MocCoreExpansion
 */
contract MocUpgradeChangerWithExpansionMock is UpgraderUUPSChangerTemplate {
    address private newMocCoreExpansion;

    constructor(
        UUPSUpgradeable _proxy,
        UpgradableMock _newImplementation,
        address _newMocCoreExpansion
    ) UpgraderUUPSChangerTemplate(_proxy, address(_newImplementation)) {
        newMocCoreExpansion = _newMocCoreExpansion;
    }

    // solhint-disable-next-line no-empty-blocks
    function _beforeUpgrade() internal override {}

    function _afterUpgrade() internal override {
        UpgradableMock upgradedProxy = UpgradableMock(address(proxy));
        upgradedProxy.initializeMock();
        MocCore(address(proxy)).setMocCoreExpansion(newMocCoreExpansion);
    }
}
