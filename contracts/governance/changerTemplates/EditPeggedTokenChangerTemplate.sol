pragma solidity 0.8.17;

import "../../interfaces/IChangeContract.sol";
import "../../interfaces/IMocRC20.sol";
import "../../core/MocCore.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
  @title EditPeggedTokenChangerTemplate
  @notice This contract is a ChangeContract intended to be used with Moc Aeropulus 
  governance system. It allows the edition of an existent Pegged Token to the system.

  @dev IMPORTANT: This template provides a basic framework for Pegged Token params editions,
  but it's not intended to be use out of the box. Depending on the combination of params
  you need to edit, you'll need to generate new methods, disable others and adjust the 
  `PARAMS_CHANGED` config. In this example, only the priceProvider address is used as showcase.
  Also please notice that params values, are not verify on the target contract, so it's desirable
  that the changer itself do it. See `AditPeggedTokenChangerTemplate.sol` for reference.
 */
contract EditPeggedTokenChangerTemplate is IChangeContract, MocHelper, Ownable {
    error InvalidParamSetCount();

    // ------- Storage -------

    MocCore public mocCore;
    IMocRC20 public tpToEdit;
    MocCore.PeggedTokenParams internal peggedTokenParams;
    uint8 public paramSet;
    uint8 public constant PARAMS_CHANGED = 1;

    /**
     * @notice Constructor
     * @param mocCore_ Address of the contract to edit the Pegged Token on
     * @param tpToEdit_ Pegged Token Address to edit, needs to belong to `mocCore_`
     */
    constructor(MocCore mocCore_, IMocRC20 tpToEdit_) {
        mocCore = mocCore_;
        tpToEdit = tpToEdit_;

        (, bool exists) = mocCore.peggedTokenIndex(address(tpToEdit));
        if (!exists) revert InvalidAddress();
    }

    /**
     * @notice contract initializer
     * @param priceProvider_  new pegged token price provider
     */
    function setPriceProvider(address priceProvider_) external onlyOwner {
        if (paramSet != 0) revert InvalidParamSetCount();
        // Increase param set to allow execution
        paramSet++;
        // Fetched the pegged Token index by token address
        (uint8 i, ) = mocCore.peggedTokenIndex(address(tpToEdit));
        // Fetched all values for the given index
        (, uint256 emaSf) = mocCore.tpEma(i);
        (, uint256 tiMin, uint256 tiMax) = mocCore.tpInterestRate(i);
        (int256 abeq, int256 facMinSubOne, int256 facMax) = mocCore.tpFAC(i);

        // Only edits the priceProvider, all the other values are taken from the contracts itself
        peggedTokenParams = MocCore.PeggedTokenParams(
            // tpTokenAddress
            address(tpToEdit),
            // priceProviderAddress
            priceProvider_,
            // Pegged Token target coverage [PREC]
            mocCore.tpCtarg(i),
            // Pegged Token reserve factor [PREC]
            mocCore.tpR(i),
            // Pegged Token minimum amount of blocks until the settlement to charge interest for redeem [N]
            mocCore.tpBmin(i),
            // fee pct sent to Fee Flow for mint [PREC]
            mocCore.tpMintFee(i),
            // fee pct sent to Fee Flow for redeem [PREC]
            mocCore.tpRedeemFee(i),
            // Emma is not editable, only initialized
            0,
            // Pegged Token smoothing factor [PREC]
            emaSf,
            // Pegged Token initial interest rate (tpTils), not editable, only initialized
            0,
            // Pegged Token minimum interest rate that can be charged
            tiMin,
            // Pegged Token maximum interest rate that can be charged
            tiMax,
            // abundance of Pegged Token where it is desired that the model stabilizes
            abeq,
            // Pegged Token minimum correction factor for interest rate
            facMinSubOne + int256(ONE),
            // Pegged Token maximum correction factor for interest rate
            facMax
        );
    }

    /**
     * @notice Returns the Pegged Token Params configurations that's going to be edited
     */
    function getPeggedTokenParams() public view returns (MocCore.PeggedTokenParams memory) {
        return peggedTokenParams;
    }

    /**
     * @notice Execute the changes.
     * @dev Should be called by the governor, but this contract does not check that explicitly
     * because it is not its responsibility in the current architecture
     */
    function execute() external {
        if (paramSet != PARAMS_CHANGED) revert InvalidParamSetCount();
        mocCore.editPeggedToken(peggedTokenParams);
        // Blocks re-execution
        paramSet++;
    }
}