pragma solidity 0.8.17;

import "../../interfaces/IChangeContract.sol";
import "../../core/MocCore.sol";

/**
  @title AddPeggedTokenChangerTemplate
  @notice This contract is a ChangeContract intended to be used with Moc Aeropulus 
  governance system. It allows the addition of a new Pegged Token to the system.
 */
contract AddPeggedTokenChangerTemplate is IChangeContract, MocHelper {
    // ------- Storage -------

    MocCore public mocCore;
    MocCore.PeggedTokenParams internal peggedTokenParams;

    /** 
    @notice Constructor
    @param mocCore_ Address of the contract to add Pegged Token to
  */
    constructor(MocCore mocCore_, MocCore.PeggedTokenParams memory peggedTokenParams_) {
        mocCore = mocCore_;
        peggedTokenParams = peggedTokenParams_;

        if (peggedTokenParams_.tpCtarg < ONE) revert InvalidValue();
        if (peggedTokenParams_.tpMintFee > PRECISION) revert InvalidValue();
        if (peggedTokenParams_.tpRedeemFee > PRECISION) revert InvalidValue();
        if (peggedTokenParams_.tpEmaSf >= ONE) revert InvalidValue();
        if (peggedTokenParams_.tpTils > PRECISION) revert InvalidValue();
        if (peggedTokenParams_.tpTiMin > PRECISION) revert InvalidValue();
        if (peggedTokenParams_.tpTiMax > PRECISION) revert InvalidValue();
        if (peggedTokenParams_.tpAbeq > int256(ONE)) revert InvalidValue();
        if (peggedTokenParams_.tpFacMin > int256(ONE)) revert InvalidValue();
        if (peggedTokenParams_.tpFacMax < int256(ONE)) revert InvalidValue();
    }

    /**
    @notice Execute the changes.
    @dev Should be called by the governor, but this contract does not check that explicitly
    because it is not its responsibility in the current architecture
   */
    function execute() external {
        mocCore.addPeggedToken(peggedTokenParams);
    }
}
