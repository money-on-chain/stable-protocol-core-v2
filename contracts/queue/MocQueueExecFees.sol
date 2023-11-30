// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import { MocAccessControlled } from "../utils/MocAccessControlled.sol";

/**
 * @title MocQueue Execution Fee: Handles Queuing execution fees
 */
abstract contract MocQueueExecFees is MocAccessControlled {
    // Set of Deferrable Operation Types
    enum OperType {
        none, // avoid using zero as Type
        mintTC,
        redeemTC,
        mintTP,
        redeemTP,
        mintTCandTP,
        redeemTCandTP,
        swapTCforTP,
        swapTPforTC,
        swapTPforTP
    }

    // ------- Custom Errors -------

    // Wrong amount of coinbase set as execution fee
    error WrongExecutionFee(uint256 expectedValue);
    // Failure on Executor payment address coinbase transfer
    error ExecutionFeePaymentFailed();
    // Action not allow when queue is not empty
    error NotAllowOnNoneEmptyQueue();

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

    // OperType => Execution fee
    mapping(OperType => uint256) public execFee;

    // ------- Initializer -------

    function __MocQueueExecFees_init(
        InitializeMocQueueExecFeesParams calldata mocQueueExecFeesParams_
    ) internal onlyInitializing {
        _setExecutionFees(mocQueueExecFeesParams_);
    }

    // ------- Abstract Functions -------

    /**
     * @notice true if the queue is empty
     */
    function isEmpty() public view virtual returns (bool isEmpty);

    // ------- Internal Functions -------

    /**
     * @notice verifies that operation execution fee sent (msg.value) is equal to `operationFee`
     * reverts, with WrongExecutionFee error is not.
     */
    function verifyExecFee(uint256 operationFee) internal {
        if (operationFee != msg.value) revert WrongExecutionFee(operationFee);
    }

    /**
     * @notice sets Execution Fees absolute values for each operation type
     */
    function _setExecutionFees(InitializeMocQueueExecFeesParams calldata mocQueueExecFeesParams_) internal {
        execFee[OperType.mintTC] = mocQueueExecFeesParams_.tcMintExecFee;
        execFee[OperType.redeemTC] = mocQueueExecFeesParams_.tcRedeemExecFee;
        execFee[OperType.mintTP] = mocQueueExecFeesParams_.tpMintExecFee;
        execFee[OperType.redeemTP] = mocQueueExecFeesParams_.tpRedeemExecFee;
        execFee[OperType.swapTPforTP] = mocQueueExecFeesParams_.swapTPforTPExecFee;
        execFee[OperType.swapTPforTC] = mocQueueExecFeesParams_.swapTPforTCExecFee;
        execFee[OperType.swapTCforTP] = mocQueueExecFeesParams_.swapTCforTPExecFee;
        execFee[OperType.redeemTCandTP] = mocQueueExecFeesParams_.redeemTCandTPExecFee;
        execFee[OperType.mintTCandTP] = mocQueueExecFeesParams_.mintTCandTPExecFee;
    }

    /**
     * @notice verifies if the queue is empty, reverts if not
     */
    function _verifyEmptyQueue() internal view {
        if (!isEmpty()) revert NotAllowOnNoneEmptyQueue();
    }

    // ------- External Functions -------

    function getAndVerifyExecFee(OperType operType_, uint256 value_) external view returns (uint256 currentExecFee) {
        currentExecFee = execFee[operType_];
        if (currentExecFee > value_) revert WrongExecutionFee(currentExecFee);
    }

    // ------- Only Authorized Changer Functions -------

    function updateExecutionFees(
        InitializeMocQueueExecFeesParams calldata mocQueueExecFeesParams_
    ) external onlyAuthorizedChanger {
        _verifyEmptyQueue();
        _setExecutionFees(mocQueueExecFeesParams_);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
