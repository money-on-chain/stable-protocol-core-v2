// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { MocAccessControlled } from "../utils/MocAccessControlled.sol";

/**
 * @title MocQueue Execution Fee: Handles Queuing execution fees
 */
abstract contract MocQueueExecFees is MocAccessControlled {
    // ------- Custom Errors -------

    // Wrong amount of coinbase set as execution fee
    error WrongExecutionFee(uint256 expectedValue);
    // Failure on Executor payment address coinbase transfer
    error ExecutionFeePaymentFailed();

    // ------- Structs -------

    struct InitializeMocQueueExecFeesParams {
        // absolute coinbase execution fee applied on Collateral Tokens mint
        uint256 tcMintExecFee;
        // absolute coinbase execution fee applied on Collateral Tokens redeem
        uint256 tcRedeemExecFee;
        // absolute coinbase execution fee applied on Pegged Tokens mint
        uint256 tpMintExecFee;
        // absolute coinbase execution fee applied on Pegged Tokens redeem
        uint256 tpRedeemExecFee;
        // absolute coinbase execution fee applied on swap a Pegged Token for another Pegged Token
        uint256 swapTPforTPExecFee;
        // absolute coinbase execution fee applied on swap a Pegged Token for Collateral Token
        uint256 swapTPforTCExecFee;
        // absolute coinbase execution fee applied on swap Collateral Token for a Pegged Token
        uint256 swapTCforTPExecFee;
        // absolute coinbase execution fee applied on redeem Collateral Token and Pegged Token in one operations
        uint256 redeemTCandTPExecFee;
        // absolute coinbase execution fee applied on mint Collateral Token and Pegged Token in one operation
        uint256 mintTCandTPExecFee;
    }

    // absolute coinbase execution fee applied on Collateral Tokens mint
    uint256 public tcMintExecFee;
    // absolute coinbase execution fee applied on Collateral Tokens redeem
    uint256 public tcRedeemExecFee;
    // absolute coinbase execution fee applied on Pegged Tokens mint
    uint256 public tpMintExecFee;
    // absolute coinbase execution fee applied on Pegged Tokens redeem
    uint256 public tpRedeemExecFee;
    // absolute coinbase execution fee applied on swap a Pegged Token for another Pegged Token
    uint256 public swapTPforTPExecFee;
    // absolute coinbase execution fee applied on swap a Pegged Token for Collateral Token
    uint256 public swapTPforTCExecFee;
    // absolute coinbase execution fee applied on swap Collateral Token for a Pegged Token
    uint256 public swapTCforTPExecFee;
    // absolute coinbase execution fee applied on redeem Collateral Token and Pegged Token in one operations
    uint256 public redeemTCandTPExecFee;
    // absolute coinbase execution fee applied on mint Collateral Token and Pegged Token in one operation
    uint256 public mintTCandTPExecFee;

    // ------- Initializer -------

    function __MocQueueExecFees_init(
        InitializeMocQueueExecFeesParams calldata mocQueueExecFeesParams_
    ) internal onlyInitializing {
        tcMintExecFee = mocQueueExecFeesParams_.tcMintExecFee;
        tcRedeemExecFee = mocQueueExecFeesParams_.tcRedeemExecFee;
        tpMintExecFee = mocQueueExecFeesParams_.tpMintExecFee;
        tpRedeemExecFee = mocQueueExecFeesParams_.tpRedeemExecFee;
        swapTPforTPExecFee = mocQueueExecFeesParams_.swapTPforTPExecFee;
        swapTPforTCExecFee = mocQueueExecFeesParams_.swapTPforTCExecFee;
        swapTCforTPExecFee = mocQueueExecFeesParams_.swapTCforTPExecFee;
        redeemTCandTPExecFee = mocQueueExecFeesParams_.redeemTCandTPExecFee;
        mintTCandTPExecFee = mocQueueExecFeesParams_.mintTCandTPExecFee;
    }

    // ------- Internal Functions -------

    function verifyExecFee(uint256 operationFee) internal {
        if (operationFee != msg.value) revert WrongExecutionFee(operationFee);
    }

    // ------- External Functions -------

    // ------- Only Authorized Changer Functions -------

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
