// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { MocQueue, MocCore } from "../queue/MocQueue.sol";

/**
 * @title MocQueueMock: Allows Deferral execution without error handling
 * @dev Intended to allow Deferral testing using behaviors, including error tests
 */
contract MocQueueMock is MocQueue {
    function _executeMintTC(uint256 operId_) internal override {
        MocCore.MintTCParams memory params = operationsMintTC[operId_];
        (uint256 _qACtotalNeeded, , MocCore.FeeCalcs memory _feeCalcs) = mocCore.execMintTC(params);
        _onDeferredTCMinted(operId_, params, _qACtotalNeeded, _feeCalcs);
        delete operationsMintTC[operId_];
    }

    function _executeRedeemTC(uint256 operId_) internal override {
        MocCore.RedeemTCParams memory params = operationsRedeemTC[operId_];
        (uint256 _qACRedeemed, , MocCore.FeeCalcs memory _feeCalcs) = mocCore.execRedeemTC(params);
        _onDeferredTCRedeemed(operId_, params, _qACRedeemed, _feeCalcs);
        delete operationsRedeemTC[operId_];
    }

    function _executeMintTP(uint256 operId_) internal override {
        MocCore.MintTPParams memory params = operationsMintTP[operId_];
        (uint256 _qACtotalNeeded, , MocCore.FeeCalcs memory _feeCalcs) = mocCore.execMintTP(params);
        _onDeferredTPMinted(operId_, params, _qACtotalNeeded, _feeCalcs);
        delete operationsMintTP[operId_];
    }

    function _executeRedeemTP(uint256 operId_) internal override {
        MocCore.RedeemTPParams memory params = operationsRedeemTP[operId_];
        (uint256 _qACRedeemed, , MocCore.FeeCalcs memory _feeCalcs) = mocCore.execRedeemTP(params);
        _onDeferredTPRedeemed(operId_, params, _qACRedeemed, _feeCalcs);
        delete operationsRedeemTP[operId_];
    }
}
