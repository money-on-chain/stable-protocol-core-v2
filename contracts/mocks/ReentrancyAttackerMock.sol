pragma solidity 0.8.16;
import "hardhat/console.sol";

contract ReentrancyAttackerMock {
    address internal dest;
    bytes internal data;
    bool internal entered;
    bytes internal returnError;

    function forward(address dest_, bytes memory data_) public payable returns (bytes memory) {
        dest = dest_;
        data = data_;
        // solhint-disable-next-line avoid-low-level-calls
        (, bytes memory returndata) = dest_.call{ value: msg.value }(data_);
        if (entered) return (returndata);
        returndata = returnError;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let returndata_size := mload(returndata)
            revert(add(32, returndata), returndata_size)
        }
    }

    // solhint-disable-next-line no-complex-fallback
    fallback() external payable {
        entered = true;
        bytes memory returndata = forward(dest, data);
        returnError = returndata;
        entered = false;
    }
}
