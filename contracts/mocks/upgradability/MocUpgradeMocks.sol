pragma solidity 0.8.16;

// This contract is not intended to be used in a production system
// It was designed to be using in a testing environment only

import "../../governance/changerTemplates/UpgraderUUPSChangerTemplate.sol";
import "../../collateral/coinbase/MocCACoinbase.sol";
import "../../collateral/rc20/MocCARC20.sol";
import "../../collateral/collateralBag/MocCAWrapper.sol";

/**
 * @title UpgradableMock
 * @dev Only for upgradability testing purpuses. Generic contract for initiliaze a mock and get a custom method.
 */
abstract contract UpgradableMock {
    uint256 public newVariable;

    function initializeMock() external {
        newVariable = 42;
    }

    function getCustomMockValue() external view virtual returns (uint256);
}

/**
 * @title MocCoinbaseMock
 * @dev Only for upgradability testing purpuses. Extends MocCACoinbase adding a new variable.
 */
contract MocCoinbaseMock is MocCACoinbase, UpgradableMock {
    function getCustomMockValue() external view override returns (uint256) {
        return newVariable + (ctarg / PRECISION);
    }
}

/**
 * @title MocCARC20Mock
 * @dev Only for upgradability testing purpuses. Extends MocCARC20Mock adding a new variable.
 */
contract MocCARC20Mock is MocCARC20, UpgradableMock {
    function getCustomMockValue() external view override returns (uint256) {
        return newVariable + (ctarg / PRECISION);
    }
}

/**
 * @title MocCARC20Mock
 * @dev Only for upgradability testing purpuses. Extends MocCARC20Mock adding a new variable.
 */
contract MocCAWrapperMock is MocCAWrapper, UpgradableMock {
    function getCustomMockValue() external view override returns (uint256) {
        return newVariable + (mocCore.ctarg() / PRECISION);
    }
}

/**
 * @title MocUpgradeChangerMock
 * @dev Only for upgradability testing purpuses. Extends UpgraderUUPSTemplate so that it
 * can upgrade, via UUPS, the original Moc CA implementation
 */
// solhint-disable no-empty-blocks
contract MocUpgradeChangerMock is UpgraderUUPSChangerTemplate {
    constructor(UUPSUpgradeable _proxy, UpgradableMock _newImplementation)
        UpgraderUUPSChangerTemplate(_proxy, address(_newImplementation))
    {}

    function _beforeUpgrade() internal override {}

    function _afterUpgrade() internal override {
        UpgradableMock upgradedProxy = UpgradableMock(address(proxy));
        upgradedProxy.initializeMock();
    }
}
