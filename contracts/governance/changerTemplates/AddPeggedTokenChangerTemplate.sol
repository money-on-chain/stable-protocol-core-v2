// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import { IChangeContract } from "../../interfaces/IChangeContract.sol";
import { MocCore, PeggedTokenParams } from "../../core/MocCore.sol";
import { MocHelper } from "../../utils/MocHelper.sol";

/**
 * @title AddPeggedTokenChangerTemplate
 * @notice This contract is a ChangeContract intended to be used with Moc Aeropulus
 * governance system. It allows the addition of a new Pegged Token to the system.
 */
contract AddPeggedTokenChangerTemplate is IChangeContract, MocHelper {
    // ------- Storage -------

    MocCore public mocCore;
    PeggedTokenParams internal peggedTokenParams;

    /**
     * @notice Constructor
     * @param mocCore_ Address of the contract to add Pegged Token to
     */
    constructor(MocCore mocCore_, PeggedTokenParams memory peggedTokenParams_) {
        mocCore = mocCore_;
        peggedTokenParams = peggedTokenParams_;

        if (peggedTokenParams_.tpCtarg < ONE) revert InvalidValue();
        _checkLessThanOne(peggedTokenParams_.tpMintFee);
        _checkLessThanOne(peggedTokenParams_.tpRedeemFee);
        if (peggedTokenParams_.tpEmaSf >= ONE) revert InvalidValue();
    }

    /**
     * @notice Returns the Pegged Token Params configurations that's going to be added
     */
    function getPeggedTokenParams() external view returns (PeggedTokenParams memory) {
        return peggedTokenParams;
    }

    /**
     * @notice Execute the changes.
     * @dev Should be called by the governor, but this contract does not check that explicitly
     * because it is not its responsibility in the current architecture
     */
    function execute() external {
        mocCore.addPeggedToken(peggedTokenParams);
    }
}
