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
}
