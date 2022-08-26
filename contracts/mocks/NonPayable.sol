pragma solidity 0.8.16;

contract NonPayable {
    // solhint-disable-next-line no-empty-blocks
    constructor() payable {}

    function forward(address dest_, bytes calldata data_) external payable {
        // solhint-disable-next-line avoid-low-level-calls
        dest_.call{ value: msg.value }(data_);
    }
}
