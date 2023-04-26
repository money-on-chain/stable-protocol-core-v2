// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

import { IChangeContract } from "../../interfaces/IChangeContract.sol";
import { MocCore, PeggedTokenParams } from "../../core/MocCore.sol";
import { MocHelper } from "../../utils/MocHelper.sol";
import { MocRC20 } from "../../tokens/MocRC20.sol";

/**
 * @title AddPeggedTokenChangerTemplate
 * @notice This contract is a ChangeContract intended to be used with Moc Aeropulus
 * governance system. It allows the addition of a new Pegged Token to the system.
 * @dev This template only considers adding MocRC20, they are governed and use EnumerableAccessControl for roles.
    For any other type of Pegged Token it must be modified to achieve similar validations
 */
contract AddPeggedTokenChangerTemplate is IChangeContract, MocHelper {
    bytes32 private constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 private constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 private constant DEFAULT_ADMIN_ROLE = 0x00;

    error InvalidRoles();
    error InvalidGovernor();
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
        MocRC20 peggedToken = MocRC20(peggedTokenParams_.tpTokenAddress);
        // true if only mocCore has Minter Role
        bool validMinterRole = peggedToken.hasRole(MINTER_ROLE, address(mocCore_)) &&
            peggedToken.getRoleMemberCount(MINTER_ROLE) == 1;
        // true if only mocCore has Burner Role
        bool validBurnerRole = peggedToken.hasRole(BURNER_ROLE, address(mocCore_)) &&
            peggedToken.getRoleMemberCount(BURNER_ROLE) == 1;
        // true if only mocCore has Admin Role
        bool validAdminRole = peggedToken.hasRole(DEFAULT_ADMIN_ROLE, address(mocCore_)) &&
            peggedToken.getRoleMemberCount(DEFAULT_ADMIN_ROLE) == 1;
        if ((validMinterRole && validBurnerRole && validAdminRole) == false) revert InvalidRoles();
        if (peggedToken.governor() != mocCore_.governor()) revert InvalidGovernor();
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
