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

    // ------- External Functions -------

    /**
     * @notice get execution fee for the operation requested
     *  reverts if value sent is not enough to pay the execution fee
     * @dev only used for coinbase flavor
     * @param operType_ operation type registered
     * @param value_ value sent to pay execution fee
     * @return currentExecFee execution fee required for the operation
     */
    function getAndVerifyExecFee(OperType operType_, uint256 value_) external view returns (uint256 currentExecFee) {
        currentExecFee = execFee[operType_];
        if (currentExecFee > value_) revert WrongExecutionFee(currentExecFee);
    }

    // ------- Only Authorized Changer Functions -------

    /**
     * @notice Updates executions fees with absolute values for each operation type
     * @dev When the changer is executed there could be pending operations on the queue, thats means that
     *  users have already paid for those operations, so, two situations could occur:
     *  1. If execution fees are decreased, the executor will receive all the new fees and the
     *       remaining funds will stay in this contract
     *  2. If execution fees are increased, the executor will receive less fees, unless this contract has funds
     *       remaining from another execution fee update (1.) or previously sent by another address
     * @param mocQueueExecFeesParams_ new execution fees
     */
    function updateExecutionFees(
        InitializeMocQueueExecFeesParams calldata mocQueueExecFeesParams_
    ) external onlyAuthorizedChanger {
        _setExecutionFees(mocQueueExecFeesParams_);
    }

    // @notice used to receive extra executions fee payment
    /* solhint-disable-next-line no-empty-blocks */
    receive() external payable {}

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
