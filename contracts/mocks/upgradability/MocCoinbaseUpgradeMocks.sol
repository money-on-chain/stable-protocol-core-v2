pragma solidity 0.8.16;

// This contract is not intended to be used in a production system
// It was designed to be using in a testing environment only

import "../../governance/changerTemplates/UpgraderUUPSChangerTemplate.sol";
import "../../collateral/coinbase/MocCACoinbase.sol";

/**
 * @title MocCoinbaseMock
 * @dev Only for upgradability testing purpuses. Extends MocCACoinbase adding a new variable.
 */
contract MocCoinbaseMock is MocCACoinbase {
    uint256 public newVariable;

    function initializeMock() public {
        newVariable = 42;
    }

    function getCustomMockValue() public view returns (uint256) {
        return newVariable + (ctarg / PRECISION);
    }
}

/**
 * @title MocCoinbaseUpgradeChangerMock
 * @dev Only for upgradability testing purpuses. Extends UpgraderUUPSTemplate so that it
 * can upgrade, via UUPS, the original MocCACoinbase with MocCoinbaseMock implementation
 */
// solhint-disable no-empty-blocks
contract MocCoinbaseUpgradeChangerMock is UpgraderUUPSChangerTemplate {
    constructor(UUPSUpgradeable _proxy, MocCoinbaseMock _newImplementation)
        UpgraderUUPSChangerTemplate(_proxy, address(_newImplementation))
    {}

    function _beforeUpgrade() internal override {}

    function _afterUpgrade() internal override {
        MocCoinbaseMock upgradedProxy = MocCoinbaseMock(address(proxy));
        upgradedProxy.initializeMock();
    }
}
