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
        delete operationsMintTC[operId_];
        (uint256 _qACtotalNeeded, , MocCore.FeeCalcs memory _feeCalcs) = mocCore.execMintTC(params);
        _onDeferredTCMinted(operId_, params, _qACtotalNeeded, _feeCalcs);
    }

    function _executeRedeemTC(uint256 operId_) internal override {
        MocCore.RedeemTCParams memory params = operationsRedeemTC[operId_];
        delete operationsRedeemTC[operId_];
        (uint256 _qACRedeemed, , MocCore.FeeCalcs memory _feeCalcs) = mocCore.execRedeemTC(params);
        _onDeferredTCRedeemed(operId_, params, _qACRedeemed, _feeCalcs);
    }

    function _executeMintTP(uint256 operId_) internal override {
        MocCore.MintTPParams memory params = operationsMintTP[operId_];
        delete operationsMintTP[operId_];
        (uint256 _qACtotalNeeded, , MocCore.FeeCalcs memory _feeCalcs) = mocCore.execMintTP(params);
        _onDeferredTPMinted(operId_, params, _qACtotalNeeded, _feeCalcs);
    }

    function _executeRedeemTP(uint256 operId_) internal override {
        MocCore.RedeemTPParams memory params = operationsRedeemTP[operId_];
        delete operationsRedeemTP[operId_];
        (uint256 _qACRedeemed, , MocCore.FeeCalcs memory _feeCalcs) = mocCore.execRedeemTP(params);
        _onDeferredTPRedeemed(operId_, params, _qACRedeemed, _feeCalcs);
    }

    function _executeMintTCandTP(uint256 operId_) internal override {
        MocCore.MintTCandTPParams memory params = operationsMintTCandTP[operId_];
        delete operationsMintTCandTP[operId_];
        (uint256 _qACtotalNeeded, uint256 _qTPMinted, , MocCore.FeeCalcs memory _feeCalcs) = mocCore.execMintTCandTP(
            params
        );
        _onDeferredTCandTPMinted(operId_, params, _qTPMinted, _qACtotalNeeded, _feeCalcs);
    }

    function _executeRedeemTCandTP(uint256 operId_) internal override {
        MocCore.RedeemTCandTPParams memory params = operationsRedeemTCandTP[operId_];
        delete operationsRedeemTCandTP[operId_];
        (uint256 _qACRedeemed, uint256 _qTPRedeemed, , MocCore.FeeCalcs memory _feeCalcs) = mocCore.execRedeemTCandTP(
            params
        );
        _onDeferredTCandTPRedeemed(operId_, params, _qTPRedeemed, _qACRedeemed, _feeCalcs);
    }

    function _executeSwapTCforTP(uint256 operId_) internal override {
        MocCore.SwapTCforTPParams memory params = operationsSwapTCforTP[operId_];
        delete operationsSwapTCforTP[operId_];
        (, uint256 qTPMinted, , MocCore.FeeCalcs memory _feeCalcs) = mocCore.execSwapTCforTP(params);
        _onDeferredTCforTPSwapped(operId_, params, qTPMinted, _feeCalcs);
    }

    function _executeSwapTPforTC(uint256 operId_) internal override {
        MocCore.SwapTPforTCParams memory params = operationsSwapTPforTC[operId_];
        delete operationsSwapTPforTC[operId_];
        (, uint256 qTCMinted, , MocCore.FeeCalcs memory _feeCalcs) = mocCore.execSwapTPforTC(params);
        _onDeferredTPforTCSwapped(operId_, params, qTCMinted, _feeCalcs);
    }

    function _executeSwapTPforTP(uint256 operId_) internal override {
        MocCore.SwapTPforTPParams memory params = operationsSwapTPforTP[operId_];
        delete operationsSwapTPforTP[operId_];
        (, uint256 qTPMinted, , MocCore.FeeCalcs memory _feeCalcs) = mocCore.execSwapTPforTP(params);
        _onDeferredTPforTPSwapped(operId_, params, qTPMinted, _feeCalcs);
    }
}
